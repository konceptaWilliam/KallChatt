CREATE TABLE IF NOT EXISTS message_reactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  type       text NOT NULL CHECK (type IN ('👍', '👎', '❓')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (message_id, user_id, type)
);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reactions: read if group member" ON message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN threads t ON t.id = m.thread_id
      WHERE m.id = message_reactions.message_id
        AND is_group_member(t.group_id)
    )
  );

CREATE POLICY "reactions: insert own" ON message_reactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "reactions: delete own" ON message_reactions
  FOR DELETE USING (user_id = auth.uid());
