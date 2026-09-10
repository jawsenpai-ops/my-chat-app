CREATE TABLE IF NOT EXISTS friend_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  senderId INT NOT NULL,
  receiverId INT NOT NULL,
  status ENUM('pending', 'accepted', 'declined', 'cancelled') NOT NULL DEFAULT 'pending',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiverId) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_friend_request_pair (senderId, receiverId),
  INDEX idx_friend_requests_receiver_status (receiverId, status),
  INDEX idx_friend_requests_sender_status (senderId, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS friendships (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  friendId INT NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (friendId) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_friendship (userId, friendId),
  CONSTRAINT chk_friendship_order CHECK (userId < friendId)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS blocked_users (
  blockerId INT NOT NULL,
  blockedId INT NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (blockerId, blockedId),
  FOREIGN KEY (blockerId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blockedId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;