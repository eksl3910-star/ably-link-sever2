# abiy-link-sever2

에이블리 링크 교환 서비스 — Next.js 15 + Cloudflare Pages + D1

> **주의:** 이 저장소는 다른 프로젝트에서 복제된 코드를 바탕으로 합니다. Cloudflare **D1·Pages 프로젝트·Worker 이름**은 원본(`ably-link-server` 등)과 **반드시 분리**하고, `wrangler.toml`의 `database_id`에 **원본과 동일한 UUID를 넣지 마세요.** 데이터가 섞입니다.

## 로컬 개발

```bash
pnpm install
pnpm dev
```

## D1 데이터베이스 설정

### Pages에 D1 연결 (필수 — 회원가입/DB 오류 방지)

GitHub Actions로 배포해도 **`wrangler.toml`만으로는 Pages 런타임에 D1이 붙지 않습니다.** 대시보드에서 꼭 연결하세요.

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → 프로젝트 **`ably-link-sever2`** (이 저장소 전용으로 생성)
2. **Settings** → **Functions** → **D1 database bindings**
3. **Add binding**
   - **Variable name**: `DB` ← 코드와 반드시 동일
   - **D1 database**: **`ably-link-sever2-db`** (이 저장소 전용으로 새로 만든 D1만 선택)
4. **Production**과 **Preview** 탭(또는 환경) **둘 다** 같은 바인딩이 있는지 확인
5. 저장 후 **재배포** (빈 커밋 push 또는 Actions 다시 실행)

### 스키마 / wrangler

1. Cloudflare Dashboard 또는 CLI로 D1 **`ably-link-sever2-db`** 생성 (원본 DB와 공유 금지)
2. 루트 `wrangler.toml` 및 `workers/daily-reset/wrangler.toml`의 **`database_id`**를 생성된 UUID로 채움 (플레이스홀더 `00000000-…` 교체)
3. 마이그레이션 실행:

```bash
npx wrangler d1 execute ably-link-sever2-db --local --file=./migrations/0001_schema.sql
# 기존 DB에 `users.email` 컬럼이 있으면 닉네임 컬럼으로 이름만 변경:
npx wrangler d1 execute ably-link-sever2-db --remote --file=./migrations/0002_users_nickname.sql
```

회원가입·로그인은 **이메일이 아니라 닉네임**(영어·한글·숫자, 2~20자)으로 합니다.

- **기존 DB**에 `users.email` 컬럼이 남아 있을 때만 `0002_users_nickname.sql`을 **한 번** 실행하세요.
- **새로** 현재 버전의 `0001_schema.sql`로 만든 DB는 처음부터 `nickname` 컬럼이라 `0002`는 실행하지 마세요. (`email` 컬럼이 없으면 `ALTER RENAME`이 실패합니다.)
- 점검 화면 **추가 안내 문구**를 쓰려면 `0003_settings_maintenance_message.sql`을 **한 번** 실행하세요. (`settings.maintenance_message` 컬럼 추가)

## 환경 변수 (Cloudflare Pages > Settings > Environment Variables)

| 변수 | 설명 |
|------|------|
| `ADMIN_BASIC_USER` | **`/admin` 페이지**를 브라우저로 열 때 Basic Auth 아이디 (필수·프로덕션) |
| `ADMIN_BASIC_PASS` | **`/admin` 페이지** Basic Auth 비밀번호 (필수·프로덕션) |
| `ADMIN_TOGGLE_PASS` | 관리자 화면 **폼**에서 점검·통계 API에 넣는 비밀번호. 없으면 `ADMIN_BASIC_PASS`로 검증 |
| `ADMIN_GATE_SECRET` | (선택) Basic 통과 후 발급되는 **게이트 쿠키** 서명용 비밀. 없으면 `ADMIN_TOGGLE_PASS` → `ADMIN_BASIC_PASS` → `ADMIN_BASIC_USER:ADMIN_BASIC_PASS` 순으로 사용 |

- **`/admin` HTML**만 미들웨어에서 Basic Auth를 요구합니다. Next.js가 같은 URL로 RSC 요청을 보낼 때 브라우저가 `Authorization`을 안 붙이는 경우가 있어, **Basic 검증에 성공하면 12시간짜리 httpOnly 쿠키(`als_admin_gate`)를 심고**, 이후 `/admin` 요청은 그 쿠키로 통과시켜 **무한 로그인 창을 막습니다.**
- **`/api/admin/*`** 에는 Basic을 걸지 않습니다. API는 POST body의 `password`로만 검증합니다.
- 로컬 `next dev`에서는 `ADMIN_BASIC_*` 가 비어 있으면 Basic을 건너뜁니다. 프로덕션(Pages)에서는 둘 다 설정하세요.

## 배포

GitHub `main` 브랜치에 push하면 GitHub Actions가 자동 배포합니다.

필요한 GitHub Secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## 프로젝트 구조

```
app/
  (auth)/login/       로그인/회원가입 페이지
  (main)/             홈 (링크 올리기/받기)
  admin/              관리자 대시보드
  maintenance/        점검 안내 페이지
  api/auth/           인증 API (register, login, logout, me, delete)
  api/links/          링크 API (submit, claim, consume, return, requeue, stats)
  api/admin/          관리자 API (maintenance, stats)
  api/settings/       설정 조회 API
lib/
  constants.ts        상수 정의
  password.ts         PBKDF2 해싱 + 타이밍 안전 비교
  session.ts          세션 쿠키 관리
  database.ts         D1 쿼리 함수 전체
migrations/
  0001_schema.sql          DB 스키마 (users.nickname)
  0002_users_nickname.sql  기존 DB용: email 컬럼 → nickname 이름 변경
middleware.ts         세션·점검 모드 등 (관리자는 페이지 내 비밀번호로 검증)
```
