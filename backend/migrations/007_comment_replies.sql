ALTER TABLE post_comments ADD COLUMN parent_comment_id INT NULL AFTER user_id;
ALTER TABLE post_comments ADD INDEX idx_post_comments_parent (parent_comment_id);
ALTER TABLE post_comments ADD CONSTRAINT fk_post_comments_parent FOREIGN KEY (parent_comment_id) REFERENCES post_comments(id) ON DELETE CASCADE;