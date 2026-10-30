ALTER TABLE evaluations ADD COLUMN comments_json TEXT NOT NULL DEFAULT '["","","","","","",""]';
ALTER TABLE evaluations ADD COLUMN general_comment TEXT NOT NULL DEFAULT '';
