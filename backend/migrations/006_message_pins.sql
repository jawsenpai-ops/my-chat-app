ALTER TABLE messages ADD COLUMN pinned_at DATETIME NULL;
ALTER TABLE messages ADD INDEX idx_messages_pinned (chatId, pinned_at);