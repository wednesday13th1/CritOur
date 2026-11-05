-- Apply after the Studio task schema. Rollback: restore the previous application
-- version first; the unused mapping table can remain without affecting tasks.
CREATE TABLE IF NOT EXISTS cm_canvas_cells (
  project_id TEXT NOT NULL REFERENCES studio_projects(id) ON DELETE CASCADE,
  slot INTEGER NOT NULL CHECK (slot BETWEEN 0 AND 35),
  task_id TEXT NOT NULL REFERENCES studio_tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, slot),
  UNIQUE (task_id)
);
