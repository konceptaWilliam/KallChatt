CREATE TABLE polls (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  uuid REFERENCES threads(id) ON DELETE CASCADE NOT NULL,
  question   text NOT NULL CHECK (char_length(question) <= 500),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE poll_options (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    uuid REFERENCES polls(id) ON DELETE CASCADE NOT NULL,
  text       text NOT NULL CHECK (char_length(text) <= 200),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE poll_votes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_option_id uuid REFERENCES poll_options(id) ON DELETE CASCADE NOT NULL,
  user_id        uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (poll_option_id, user_id)
);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS poll_id uuid REFERENCES polls(id) ON DELETE SET NULL;

ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "polls: read if group member" ON polls FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM threads t WHERE t.id = polls.thread_id AND is_group_member(t.group_id)
  )
);

CREATE POLICY "poll_options: read if group member" ON poll_options FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM polls p
    JOIN threads t ON t.id = p.thread_id
    WHERE p.id = poll_options.poll_id AND is_group_member(t.group_id)
  )
);

CREATE POLICY "poll_votes: read if group member" ON poll_votes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM poll_options po
    JOIN polls p ON p.id = po.poll_id
    JOIN threads t ON t.id = p.thread_id
    WHERE po.id = poll_votes.poll_option_id AND is_group_member(t.group_id)
  )
);

CREATE POLICY "poll_votes: own" ON poll_votes FOR ALL USING (user_id = auth.uid());
