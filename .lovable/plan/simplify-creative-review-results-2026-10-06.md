# Simplify Creative Review results

## What will change
- Replace numeric overall scores with one of three clear verdicts: **On Brand (Approved)**, **Minor Revisions Needed**, or **Off Brand (Rework Needed)**.
- Use the same verdict system for exactly three areas: **Brand Compliant**, **Copy**, and **Layout**.
- Show verdicts instead of numbers in Past Reviews and on each completed review.
- Collapse issues by default. Each issue opens to reveal what was flagged, the explanation, suggested fix, and cited brand guideline.

## Technical details
- Derive the three verdicts from the existing stored scores so completed reviews update without data migration.
- Combine the existing brand-related scores for Brand Compliant, use messaging for Copy, and retain layout for Layout.
- Keep image pins linked to their corresponding issue and preserve the existing cited-rule details.
- Verify the result page and Past Reviews at desktop and mobile sizes.