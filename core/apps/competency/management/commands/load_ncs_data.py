import csv
import os
from collections.abc import Iterable

from django.core.management.base import BaseCommand
from django.db import connection, transaction

from apps.competency.models import Classification, Factor, Skill


class Command(BaseCommand):
    help = "Import classifications, competency skills, and skill factors from CSV files"

    @transaction.atomic
    def handle(self, *args: Iterable[object], **options: str):
        skill_path = "apps/competency/fixtures/ncs_skill.csv"
        factor_path = "apps/competency/fixtures/ncs_factor.csv"

        if not os.path.exists(skill_path):
            self.stdout.write(self.style.ERROR(f"File not found: {skill_path}"))
            return
        if not os.path.exists(factor_path):
            self.stdout.write(self.style.ERROR(f"File not found: {factor_path}"))
            return

        self.stdout.write(self.style.SUCCESS("Processing files"))
        self._import_data(skill_path, factor_path)
        self.stdout.write(self.style.SUCCESS("Import completed successfully"))

    def _import_data(self, skill_path: str, factor_path: str):
        self._import_classifications(skill_path)
        classification_map = {c.code: c.id for c in Classification.objects.only("id", "code")}
        self._import_skills_raw(skill_path, classification_map)
        skill_map = {s.number: s.id for s in Skill.objects.only("id", "number")}
        self._import_factors_raw(factor_path, skill_map)

    def _import_classifications(self, skill_path):
        code_name_dict = {}
        parent_dict = {}
        level_dict = {}

        with open(skill_path, encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            next(reader)

            for row in reader:
                if not row or not row[0]:
                    continue

                large_code = str(row[0]).strip()
                large_name = str(row[1]).strip()
                medium_code = str(row[2]).strip()
                medium_name = str(row[3]).strip()
                small_code = str(row[4]).strip()
                small_name = str(row[5]).strip()
                detail_code = str(row[6]).strip() if len(row) > 6 and row[6] else None
                detail_name = str(row[7]).strip() if len(row) > 7 and row[7] else None

                large_full_code = large_code
                medium_full_code = f"{large_code}{medium_code}"
                small_full_code = f"{medium_full_code}{small_code}"
                detail_full_code = f"{small_full_code}{detail_code}" if detail_code else None

                code_name_dict[large_full_code] = large_name
                level_dict[large_full_code] = 1

                code_name_dict[medium_full_code] = medium_name
                level_dict[medium_full_code] = 2

                code_name_dict[small_full_code] = small_name
                level_dict[small_full_code] = 3

                if detail_full_code and detail_name:
                    code_name_dict[detail_full_code] = detail_name
                    level_dict[detail_full_code] = 4

                parent_dict[medium_full_code] = large_full_code
                parent_dict[small_full_code] = medium_full_code
                if detail_full_code:
                    parent_dict[detail_full_code] = small_full_code

        existing_classifications = {c.code: c for c in Classification.objects.only("id", "code", "name")}
        classifications_to_update = []
        tree_changed = False

        for current_level in [1, 2, 3, 4]:
            for code, name in code_name_dict.items():
                if level_dict.get(code, 0) != current_level:
                    continue

                if code in existing_classifications:
                    if existing_classifications[code].name != name:
                        existing_classifications[code].name = name
                        classifications_to_update.append(existing_classifications[code])
                    continue

                tree_changed = True
                parent_code = parent_dict.get(code)
                if current_level == 1:
                    new_node = Classification.add_root(code=code, name=name)
                else:
                    if not parent_code or parent_code not in existing_classifications:
                        continue

                    parent = existing_classifications[parent_code]
                    new_node = parent.add_child(code=code, name=name)

                existing_classifications[code] = new_node

        if classifications_to_update:
            Classification.objects.bulk_update(classifications_to_update, ["name"], batch_size=1000)

        if tree_changed:
            Classification.fix_tree()

    def _import_skills_raw(self, skill_path, classification_map):
        BATCH_SIZE = 5000
        skill_data = []
        seen = set()

        with open(skill_path, encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            next(reader)

            for row in reader:
                if not row or len(row) < 11 or not row[8]:
                    continue

                large_code = row[0].strip()
                medium_code = row[2].strip()
                small_code = row[4].strip()
                detail_code = row[6].strip() if len(row) > 6 and row[6] else ""

                if detail_code:
                    cls_code = f"{large_code}{medium_code}{small_code}{detail_code}"
                else:
                    cls_code = f"{large_code}{medium_code}{small_code}"

                if cls_code not in classification_map:
                    continue

                skill_number = row[8].strip()
                if skill_number in seen:
                    continue
                seen.add(skill_number)

                skill_data.append((
                    skill_number,
                    row[9].strip(),
                    row[10].strip(),
                    int(row[11]) if len(row) > 11 and row[11] else 1,
                    classification_map[cls_code],
                ))

                if len(skill_data) >= BATCH_SIZE:
                    self._flush_skills(skill_data)
                    skill_data = []

        if skill_data:
            self._flush_skills(skill_data)

    def _flush_skills(self, skill_data):
        with connection.cursor() as cursor:
            cursor.executemany(
                f"""
                INSERT INTO {Skill._meta.db_table} (number, code, name, level, classification_id)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (number) DO UPDATE SET
                    code = EXCLUDED.code,
                    name = EXCLUDED.name,
                    level = EXCLUDED.level,
                    classification_id = EXCLUDED.classification_id
            """,
                skill_data,
            )

    def _import_factors_raw(self, factor_path, skill_map):
        BATCH_SIZE = 5000
        factor_data = []
        seen = set()

        with open(factor_path, encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            next(reader)

            for row in reader:
                if not row or not row[0] or len(row) < 14 or not row[8]:
                    continue

                skill_number = row[8].strip()
                if skill_number not in skill_map:
                    continue

                factor_number = row[12].strip()
                if factor_number in seen:
                    continue
                seen.add(factor_number)

                factor_data.append((factor_number, row[11].strip(), row[13].strip(), skill_map[skill_number]))

                if len(factor_data) >= BATCH_SIZE:
                    self._flush_factors(factor_data)
                    factor_data = []

        if factor_data:
            self._flush_factors(factor_data)

    def _flush_factors(self, factor_data):
        with connection.cursor() as cursor:
            cursor.executemany(
                f"""
                INSERT INTO {Factor._meta.db_table} (number, code, name, skill_id)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (number) DO UPDATE SET
                    code = EXCLUDED.code,
                    name = EXCLUDED.name,
                    skill_id = EXCLUDED.skill_id
            """,
                factor_data,
            )
