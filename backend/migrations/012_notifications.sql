CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipientId INT NOT NULL,
  senderId INT NOT NULL,
  type ENUM('FRIEND_REQ', 'FRIEND_ACCEPT', 'COMMENT', 'LIKE') NOT NULL,
  entityId INT NOT NULL,
  message VARCHAR(500) NOT NULL,
  isRead BOOLEAN NOT NULL DEFAULT FALSE,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recipientId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notifications_recipient_read_created (recipientId, isRead, createdAt),
  INDEX idx_notifications_entity (entityId)
) ENGINE=InnoDB;
