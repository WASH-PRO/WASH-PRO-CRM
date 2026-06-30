"""One-off SQL patches for existing databases (create_all does not alter constraints)."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def apply_schema_patches(conn: AsyncConnection) -> None:
    await conn.execute(
        text(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.table_constraints
                    WHERE constraint_name = 'runs_schedule_id_fkey'
                      AND table_name = 'runs'
                ) THEN
                    ALTER TABLE runs DROP CONSTRAINT runs_schedule_id_fkey;
                END IF;
            END $$;
            """
        )
    )
    await conn.execute(
        text(
            """
            ALTER TABLE runs
            ADD CONSTRAINT runs_schedule_id_fkey
            FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE SET NULL;
            """
        )
    )
