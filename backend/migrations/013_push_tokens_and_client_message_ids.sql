ALTER TABLE users
  ADD COLUMN pushToken VARCHAR(255) NULL;

ALTER TABLE messages
  ADD COLUMN client_message_id VARCHAR(100) NULL,
  ADD UNIQUE KEY uq_messages_client_message (chatId, senderId, client_message_id);