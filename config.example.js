// API 설정 파일 템플릿
// 이 파일을 'config.js'로 복사한 후 실제 API 키를 입력하세요

// 사용 방법:
// 1. 이 파일을 'config.js'로 복사
// 2. 아래 API 키를 실제 키로 변경
// 3. config.js는 자동으로 .gitignore에 포함되어 GitHub에 업로드되지 않음

window.APP_CONFIG = {
    // 여기에 실제 Hugging Face API 키를 입력하세요
    HUGGINGFACE_API_KEY: 'hf_YOUR_API_KEY_HERE',
    
    // 다른 설정들
    API_TIMEOUT: 30000,
    DEBUG_MODE: true
};

console.log('🔧 설정 파일 로드됨');
