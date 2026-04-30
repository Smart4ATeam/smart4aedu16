
INSERT INTO messages (conversation_id, content, is_system, sender_id)
VALUES (
  'fdfc1736-4a6a-42bf-acab-15d2b7d524b3',
  E'補充：填寫收款資料的連結如下（請點擊或複製到瀏覽器開啟，需先登入帳號）：\n\nhttps://id-preview--93f9fb81-06af-42e1-8e70-db2d33cb4b5a.lovable.app/payee-form\n\n填寫完成後，系統將自動為您產生勞報單。',
  true,
  NULL
);

UPDATE conversation_participants
  SET unread = true
  WHERE conversation_id = 'fdfc1736-4a6a-42bf-acab-15d2b7d524b3'
    AND user_id = '9b036eda-69af-4078-b0a9-3a769c609d19';
