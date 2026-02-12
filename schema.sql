
DROP TABLE IF EXISTS Message_Library;
CREATE TABLE IF NOT EXISTS Message_Library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    relationship TEXT NOT NULL,
    tone TEXT NOT NULL,
    message_text TEXT NOT NULL,
    provider TEXT DEFAULT 'ai',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_relationship_tone ON Message_Library(relationship, tone);
