import pgtrigger


def lesson_media_unifier(lesson_media_table: str, lesson_table: str):
    return pgtrigger.Trigger(
        name=f"{lesson_media_table}_unifier",
        operation=pgtrigger.Insert | pgtrigger.Update,
        when=pgtrigger.Before,
        func=f"""
            IF EXISTS (
                SELECT 1
                FROM {lesson_media_table} lm
                JOIN {lesson_table} l ON l.id = lm.lesson_id
                WHERE lm.media_id = NEW.media_id
                  AND l.course_id = (
                      SELECT course_id
                      FROM {lesson_table}
                      WHERE id = NEW.lesson_id
                      LIMIT 1
                  )
                  AND NOT (lm.lesson_id = NEW.lesson_id AND lm.media_id = NEW.media_id)
            ) THEN
                RAISE EXCEPTION 'Media already exists in this course';
            END IF;
            RETURN NEW;
        """,
    )


def course_create_grading_policy(course_table: str, grading_policy_table: str):
    return pgtrigger.Trigger(
        name=f"{course_table}_create_grading_policy",
        operation=pgtrigger.Insert,
        when=pgtrigger.After,
        func=f"""
            INSERT INTO {grading_policy_table} (
                course_id, assessment_weight, completion_weight, completion_passing_point
            ) VALUES (
                NEW.id, 100, 0, 80
            );
            RETURN NEW;
        """,
    )
