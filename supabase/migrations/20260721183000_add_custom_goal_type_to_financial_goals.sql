alter table public.financial_goals
  add column if not exists custom_goal_type text;

alter table public.financial_goals
  drop constraint if exists financial_goals_custom_goal_type_required;

alter table public.financial_goals
  add constraint financial_goals_custom_goal_type_required
  check (
    (goal_type = 'CUSTOM' and nullif(btrim(custom_goal_type), '') is not null)
    or
    (goal_type <> 'CUSTOM' and custom_goal_type is null)
  );
