Full-week selection preview/apply/undo - manual tests

Prereqs: backend running (http://localhost:5000), admin credentials available.

1) Save (apply) or Preview planned changes
   - PowerShell helper:
    # Save/apply immediately (default save will apply selection for remaining days of the week, starting tomorrow)
    .\scripts\full-week-preview-apply.ps1 -Host "http://localhost:5000" -Username "admin" -Password "admin123" -weekKey "2025-11-24" -tellerIds "[id1]","[id2]" -count 2 -apply

    # Preview only (optional):
    .\scripts\full-week-preview-apply.ps1 -Host "http://localhost:5000" -Username "admin" -Password "admin123" -weekKey "2025-11-24" -tellerIds "[id1]","[id2]" -count 2
   - curl example (preview):
     curl -X PUT 'http://localhost:5000/api/schedule/full-week?preview=true' -H 'Authorization: Bearer <TOKEN>' -H 'Content-Type: application/json' -d '{"weekKey":"2025-11-24","tellerIds":["id1","id2"],"count":2}'

2) Apply (if you previewed) or verify save applied changes
   - PowerShell helper:
    # If you previewed above, apply with -apply. If you used the UI Save, it already applied.
    .\scripts\full-week-preview-apply.ps1 -Host "http://localhost:5000" -Username "admin" -Password "admin123" -weekKey "2025-11-24" -tellerIds "[id1]","[id2]" -count 2 -apply
   - curl example (apply):
     curl -X PUT 'http://localhost:5000/api/schedule/full-week' -H 'Authorization: Bearer <TOKEN>' -H 'Content-Type: application/json' -d '{"weekKey":"2025-11-24","tellerIds":["id1","id2"],"count":2,"confirmApply":true}'

3) Undo an applied audit
   - Using the returned auditId from apply above, run:
     .\scripts\full-week-preview-apply.ps1 -Host "http://localhost:5000" -Username "admin" -Password "admin123" -auditId "<AUDIT_ID>"
   - curl example:
     curl -X POST 'http://localhost:5000/api/schedule/full-week/undo/<AUDIT_ID>' -H 'Authorization: Bearer <TOKEN>'

4) Check assignments
   - Inspect /api/schedule/tomorrow or other day endpoints to verify changes.

Note: The backend will attempt to replace non-full-week slots first and append if not enough replaceable slots exist for the selected tellers. Audit records are stored in `FullWeekAudit` collection.
