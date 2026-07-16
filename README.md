# school-guard

## 정보 허브 명단 동기화

정보 허브가 학생 명단의 원본입니다. 정보 허브에서 명단을 업로드·추가·수정·삭제할 때만 이 앱의 Vercel API `/api/roster-import`로 전체 명단 스냅샷을 전송합니다.

Vercel 환경 변수(Production 및 Preview)에 다음 값을 설정합니다.

| 이름 | 값 |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | 선도부 Firebase 프로젝트 서비스 계정 JSON 전체 |
| `SCHOOL_GUARD_ROSTER_SECRET` | 정보 허브와 동일한 긴 임의 문자열 |

정보 허브의 `SCHOOL_GUARD_ROSTER_URL`에는 Vercel URL 뒤에 `/api/roster-import`를 붙입니다. 전출 또는 정보 허브에서 제거된 학생은 선도부에서는 비활성 처리되어 기존 지적 기록은 보존됩니다.
