ALTER TABLE chat_participants
  ADD COLUMN IF NOT EXISTS lastReadMessageId INT NULL,
  ADD COLUMN IF NOT EXISTS lastViewedMessageId INT NULL;