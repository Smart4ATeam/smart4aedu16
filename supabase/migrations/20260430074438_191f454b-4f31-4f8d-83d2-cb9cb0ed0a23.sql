
DO $$
DECLARE
  v_conv_id uuid := gen_random_uuid();
  v_user_id uuid := '9b036eda-69af-4078-b0a9-3a769c609d19';
BEGIN
  INSERT INTO conversations (id, title, category)
  VALUES (
    v_conv_id,
    '請填寫收款資料以產出勞報單',
    'system'
  );

  INSERT INTO messages (conversation_id, content, is_system, sender_id)
  VALUES (
    v_conv_id,
    E'Zin Lee 您好：\n\n您已完成任務「報名網站任務測試」（金額 NT$12,000），積分已發放。\n\n為了開立勞務報酬單（勞報單）並進行匯款作業，請您**首次填寫**收款人資料（姓名、身分證、戶籍地址、銀行帳戶、雙證件與存摺封面影本等）。\n\n👉 請點此前往填寫：[填寫收款資料](/payee-form)\n\n填寫完成並送出後，我們將為您產生勞報單，並於通知中提供簽署連結。\n\n如有任何問題，請直接於此訊息回覆。感謝您的配合！',
    true,
    NULL
  );

  INSERT INTO conversation_participants (conversation_id, user_id, unread)
  VALUES (v_conv_id, v_user_id, true);
END $$;
