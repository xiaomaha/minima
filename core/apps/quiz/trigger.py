import pgtrigger


def attempt_retry_count(attempt_table: str):
    return pgtrigger.Trigger(
        name=f"{attempt_table}_retry_count",
        when=pgtrigger.Before,
        operation=pgtrigger.Insert,
        func=f"""
            BEGIN
                SELECT COALESCE(MAX(retry), -1) + 1
                INTO NEW.retry
                FROM {attempt_table}
                WHERE quiz_id = NEW.quiz_id 
                  AND learner_id = NEW.learner_id 
                  AND context = NEW.context;
                RETURN NEW;
            END;
        """,
    )
