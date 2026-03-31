-- FTS5 virtual table for idea similarity matching (Sprint 6)
-- Used by POST /api/validate to find related ideas by keyword
CREATE VIRTUAL TABLE IF NOT EXISTS ideas_fts USING fts5(
  title,
  narrative_writeup,
  content='ideas',
  content_rowid=rowid
);

-- Populate FTS index from existing ideas
INSERT INTO ideas_fts(rowid, title, narrative_writeup)
  SELECT rowid, title, COALESCE(narrative_writeup, '') FROM ideas;

-- Triggers to keep FTS index in sync with ideas table
CREATE TRIGGER IF NOT EXISTS ideas_fts_insert AFTER INSERT ON ideas BEGIN
  INSERT INTO ideas_fts(rowid, title, narrative_writeup)
    VALUES (NEW.rowid, NEW.title, COALESCE(NEW.narrative_writeup, ''));
END;

CREATE TRIGGER IF NOT EXISTS ideas_fts_delete AFTER DELETE ON ideas BEGIN
  INSERT INTO ideas_fts(ideas_fts, rowid, title, narrative_writeup)
    VALUES ('delete', OLD.rowid, OLD.title, COALESCE(OLD.narrative_writeup, ''));
END;

CREATE TRIGGER IF NOT EXISTS ideas_fts_update AFTER UPDATE ON ideas BEGIN
  INSERT INTO ideas_fts(ideas_fts, rowid, title, narrative_writeup)
    VALUES ('delete', OLD.rowid, OLD.title, COALESCE(OLD.narrative_writeup, ''));
  INSERT INTO ideas_fts(rowid, title, narrative_writeup)
    VALUES (NEW.rowid, NEW.title, COALESCE(NEW.narrative_writeup, ''));
END;
