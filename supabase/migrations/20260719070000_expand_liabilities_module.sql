update public.liabilities
set liability_type = 'Other Liability'
where liability_type = 'Other';

alter table public.liabilities
	drop constraint if exists liabilities_liability_type_check;

alter table public.liabilities
	add constraint liabilities_liability_type_check
	check (
		liability_type in (
			'Home Loan',
			'Car Loan',
			'Personal Loan',
			'Education Loan',
			'Loan Against Property',
			'Credit Card',
			'Overdraft / Line of Credit',
			'Other Liability'
		)
	);

alter table public.liabilities
	add column if not exists due_date date,
	add column if not exists tenure_months integer,
	add column if not exists credit_limit numeric(12,2),
	add column if not exists sanction_limit numeric(12,2);

alter table public.liabilities
	drop constraint if exists liabilities_tenure_months_check,
	drop constraint if exists liabilities_credit_limit_check,
	drop constraint if exists liabilities_sanction_limit_check;

alter table public.liabilities
	add constraint liabilities_tenure_months_check check (tenure_months is null or tenure_months > 0),
	add constraint liabilities_credit_limit_check check (credit_limit is null or credit_limit >= 0),
	add constraint liabilities_sanction_limit_check check (sanction_limit is null or sanction_limit >= 0);
