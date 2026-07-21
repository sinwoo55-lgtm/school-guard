# school-guard

## 정보 허브 명단 동기화

정보 허브가 학생 명단의 원본입니다. 정보 허브에서 명단을 업로드·추가·수정·삭제할 때만 이 앱의 Vercel API `/api/roster-import`로 전체 명단 스냅샷을 전송합니다.

Vercel 환경 변수(Production 및 Preview)에 다음 값을 설정합니다.

| 이름 | 값 |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | 선도부 Firebase 프로젝트 서비스 계정 JSON 전체 |
| `SCHOOL_GUARD_ROSTER_SECRET` | 정보 허브와 동일한 긴 임의 문자열 |

정보 허브의 `SCHOOL_GUARD_ROSTER_URL`에는 Vercel URL 뒤에 `/api/roster-import`를 붙입니다. 전출 또는 정보 허브에서 제거된 학생은 선도부에서는 비활성 처리되어 기존 지적 기록은 보존됩니다.

## 정보 허브 지적사항 동기화 API

GitHub Pages는 기존 화면 호스팅으로 유지합니다. 별도로 이 저장소를 Vercel 프로젝트로 가져오면, 화면을 배포하지 않고 비공개 API `/api/discipline-export`만 사용할 수 있습니다.

Vercel 환경 변수(Production)에 다음 값을 넣습니다.

| 이름 | 값 |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | 선도부 Firebase 프로젝트 서비스 계정 JSON 전체 |
| `DISCIPLINE_SYNC_SECRET` | 정보 허브와 동일한 긴 임의 문자열 |

정보 허브의 `DISCIPLINE_EXPORT_URL`에는 이 Vercel 배포 주소 뒤에 `/api/discipline-export`를 붙여 설정합니다. API는 `Authorization: Bearer <DISCIPLINE_SYNC_SECRET>`가 일치할 때만 활성 지적사항과 학생별 집계를 반환합니다.
