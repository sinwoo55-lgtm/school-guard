# school-guard

## 정보 허브 지적사항 동기화 API

GitHub Pages는 기존 화면 호스팅으로 유지합니다. 별도로 이 저장소를 Vercel 프로젝트로 가져오면, 화면을 배포하지 않고 비공개 API `/api/discipline-export`만 사용할 수 있습니다.

Vercel 환경 변수(Production)에 다음 값을 넣습니다.

| 이름 | 값 |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | 선도부 Firebase 프로젝트 서비스 계정 JSON 전체 |
| `DISCIPLINE_SYNC_SECRET` | 정보 허브와 동일한 긴 임의 문자열 |

정보 허브의 `DISCIPLINE_EXPORT_URL`에는 이 Vercel 배포 주소 뒤에 `/api/discipline-export`를 붙여 설정합니다. API는 `Authorization: Bearer <DISCIPLINE_SYNC_SECRET>`가 일치할 때만 활성 지적사항과 학생별 집계를 반환합니다.
