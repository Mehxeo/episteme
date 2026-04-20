-- Create the user_streaks table
CREATE TABLE IF NOT EXISTS public.user_streaks (
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    current_streak int DEFAULT 0,
    longest_streak int DEFAULT 0,
    last_activity_date date,
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own streaks" 
  ON public.user_streaks 
  FOR SELECT 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own streaks" 
  ON public.user_streaks 
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own streaks" 
  ON public.user_streaks 
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Function to record activity and calculate streaks
-- Call this securely via Supabase RPC to update the user's streak for today 
CREATE OR REPLACE FUNCTION record_daily_activity()
RETURNS void AS $$
DECLARE
    today date := current_date;
    streak_record public.user_streaks%ROWTYPE;
    days_diff integer;
BEGIN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Get current record
    SELECT * INTO streak_record
    FROM public.user_streaks
    WHERE user_id = auth.uid();
    
    IF NOT FOUND THEN
        -- First time taking an action
        INSERT INTO public.user_streaks (user_id, current_streak, longest_streak, last_activity_date)
        VALUES (auth.uid(), 1, 1, today);
        RETURN;
    END IF;

    -- If already acted today, do nothing to the streak
    IF streak_record.last_activity_date = today THEN
        RETURN;
    END IF;

    -- Determine difference in days
    days_diff := today - streak_record.last_activity_date;
    
    -- If it's been exactly 1 day, increment the streak
    IF days_diff = 1 THEN
        UPDATE public.user_streaks
        SET current_streak = current_streak + 1,
            longest_streak = GREATEST(current_streak + 1, longest_streak),
            last_activity_date = today,
            updated_at = now()
        WHERE user_id = auth.uid();
    ELSE
        -- Streak broken, reset to 1
        UPDATE public.user_streaks
        SET current_streak = 1,
            last_activity_date = today,
            updated_at = now()
        WHERE user_id = auth.uid();
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
