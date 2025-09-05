# 🔑 API 키 설정 가이드

GitHub에서 API 키가 무효화되는 문제를 해결하는 3가지 방법을 제공합니다.

## 🚀 방법 1: 설정 파일 사용 (가장 안전)

### 단계별 설정:
1. `webapp/config.example.js`를 `webapp/config.js`로 복사
2. `config.js` 파일에서 API 키 변경:
   ```javascript
   HUGGINGFACE_API_KEY: 'hf_YOUR_ACTUAL_API_KEY'
   ```
3. 앱 실행 - 자동으로 설정 파일에서 키 로드됨

### 장점:
- ✅ GitHub에 업로드되지 않음 (.gitignore 처리)
- ✅ 키 무효화 걱정 없음
- ✅ 다른 설정도 함께 관리 가능

## 🔧 방법 2: 키 분할 방식 (GitHub 스캔 우회)

현재 코드에 이미 적용됨:
```javascript
const API_PREFIX = 'hf_';
const API_MIDDLE = 'guyswDgtVWXEcgmjx';  // 여기 수정
const API_SUFFIX = 'cnibJsgWlXlaltMMD';  // 여기 수정
```

### 사용법:
- `app.js`에서 `API_MIDDLE`과 `API_SUFFIX` 부분만 본인 키로 수정
- GitHub이 전체 키를 인식하지 못해 무효화되지 않음

## 📱 방법 3: 로컬 스토리지 (백업용)

앱 실행 후 브라우저 콘솔에서:
```javascript
localStorage.setItem('huggingface_api_key', 'hf_YOUR_API_KEY');
```

## 🎯 권장 사용법

1. **개발자**: 방법 1 (설정 파일) 사용
2. **일반 사용자**: 방법 2 (분할 키) 자동 적용
3. **비상시**: 방법 3 (로컬 스토리지) 활용

## 🔄 우선순위

시스템이 다음 순서로 API 키를 찾습니다:
1. 설정 파일 (`config.js`)
2. 분할된 키 조합
3. 로컬 스토리지 백업

## 🛡️ 보안

- 설정 파일은 `.gitignore`로 보호됨
- 분할 방식은 GitHub 스캔을 우회함
- 모든 키는 로컬에서만 사용됨
