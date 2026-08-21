-- =============================================================================================
-- IMPORTANT — THIS CONTENT IS NOT VERIFIED IMMIGRATION GUIDANCE.
--
-- The task list below is a plausible outline of the Engineer / Specialist in Humanities /
-- International Services route, not legal advice. Offsets are typical, not guaranteed:
-- COE processing times swing between roughly one and three months, and embassy turnaround
-- varies by country.
--
-- Before launch, every task must be checked against the Immigration Services Agency
-- (https://www.isa.go.jp/en/) and against what the user's employer's HR actually requires.
-- The app must also show the in-product disclaimer pointing users at those sources.
-- Getting a detail wrong here matters more than in most apps — people act on it.
-- =============================================================================================

INSERT INTO checklist_templates (id, visa_type, country, purpose, display_name, japanese_name,
                                 description, is_available, sort_order, created_at, updated_at)
VALUES (gen_random_uuid(), 'ENGINEER_SPECIALIST', 'JP', 'WORK',
        'Engineer / Specialist in Humanities / International Services',
        '技術・人文知識・国際業務',
        'The usual route for a software engineer hired by a Japanese company.',
        TRUE, 1, now(), now()),

       -- Listed but empty on purpose: the onboarding picker greys these out rather than
       -- hiding them, so the roadmap is visible. Give each one tasks to flip is_available.
       (gen_random_uuid(), 'WORKING_HOLIDAY', 'JP', 'WORK', 'Working Holiday', 'ワーキングホリデー',
        'Up to a year of work and travel, for eligible nationalities under 30.',
        FALSE, 2, now(), now()),
       (gen_random_uuid(), 'INSTRUCTOR', 'JP', 'WORK', 'Instructor', '教育',
        'Teaching at an elementary, junior high, or high school.',
        FALSE, 3, now(), now()),
       (gen_random_uuid(), 'STUDENT', 'JP', 'STUDY', 'Student', '留学',
        'University, language school, or vocational college.',
        FALSE, 4, now(), now()),
       (gen_random_uuid(), 'SPOUSE_OF_JAPANESE', 'JP', 'FAMILY', 'Spouse or Child of a Japanese National',
        '日本人の配偶者等', 'Married to, or the child of, a Japanese citizen.',
        FALSE, 5, now(), now()),
       (gen_random_uuid(), 'DEPENDENT', 'JP', 'FAMILY', 'Dependent', '家族滞在',
        'Joining a partner or parent who already holds a working visa.',
        FALSE, 6, now(), now()),
       (gen_random_uuid(), 'DIGITAL_NOMAD', 'JP', 'OTHER', 'Digital Nomad', '特定活動',
        'Six months for remote workers employed outside Japan.',
        FALSE, 7, now(), now());

-- Tasks for the one template that ships in the MVP.
INSERT INTO checklist_tasks (id, template_id, category, title, default_due_offset_days,
                             sort_order, created_at, updated_at)
SELECT gen_random_uuid(), t.id, v.category, v.title, v.offset_days, v.sort_order, now(), now()
FROM checklist_templates t
         CROSS JOIN (VALUES
    -- Visa and immigration ------------------------------------------------------------------
    ('VISA_IMMIGRATION', 'Confirm your employer will sponsor your Certificate of Eligibility', -120, 1),
    ('VISA_IMMIGRATION', 'Send HR your documents for the COE: passport copy, CV, diploma, photos', -110, 2),
    ('VISA_IMMIGRATION', 'Employer files the COE with the Immigration Services Agency', -90, 3),
    ('VISA_IMMIGRATION', 'Receive the original COE from your employer', -45, 4),
    ('VISA_IMMIGRATION', 'Apply for the visa at your nearest Japanese embassy or consulate', -35, 5),
    ('VISA_IMMIGRATION', 'Collect your passport with the visa attached', -25, 6),
    ('VISA_IMMIGRATION', 'Get your residence card (zairyu card) at the airport on arrival', 0, 7),
    ('VISA_IMMIGRATION', 'Register your address at the ward office within 14 days of moving in', 14, 8),

    -- Housing -------------------------------------------------------------------------------
    ('HOUSING', 'Ask HR whether company housing or a guarantor is provided', -60, 1),
    ('HOUSING', 'Book temporary accommodation for your first few weeks', -40, 2),
    ('HOUSING', 'Arrange a guarantor company if you have no Japanese guarantor', -20, 3),
    ('HOUSING', 'Sign the lease and collect the keys', 7, 4),
    ('HOUSING', 'Set up electricity, gas, water, and internet', 10, 5),

    -- Banking and money ---------------------------------------------------------------------
    ('BANKING_MONEY', 'Set up an international transfer service for moving your savings', -30, 1),
    ('BANKING_MONEY', 'Bring enough cash or a usable card for your first two weeks', -7, 2),
    ('BANKING_MONEY', 'Buy an IC card (Suica or Pasmo) for trains and convenience stores', 2, 3),
    ('BANKING_MONEY', 'Open a Japanese bank account once you have your address registered', 21, 4),

    -- Work admin ----------------------------------------------------------------------------
    ('WORK_ADMIN', 'Enroll in health insurance and pension at the ward office', 14, 1),
    ('WORK_ADMIN', 'Apply for your My Number card', 21, 2),
    ('WORK_ADMIN', 'Give HR your Japanese bank details and My Number', 30, 3),

    -- Language ------------------------------------------------------------------------------
    ('LANGUAGE', 'Reach the JLPT N5 vocabulary milestone', -60, 1),
    ('LANGUAGE', 'Practise your self-introduction (jikoshoukai)', -14, 2),
    ('LANGUAGE', 'Learn ward-office and utility vocabulary', 7, 3),

    -- Logistics -----------------------------------------------------------------------------
    ('LOGISTICS', 'Decide what to ship, sell, or put in storage', -45, 1),
    ('LOGISTICS', 'Book your flight', -30, 2),
    ('LOGISTICS', 'Tell your bank and tax office you are moving abroad', -14, 3),
    ('LOGISTICS', 'Cancel or transfer utilities, phone, and subscriptions at home', -7, 4)
) AS v(category, title, offset_days, sort_order)
WHERE t.visa_type = 'ENGINEER_SPECIALIST';
