// 전역 변수
let currentProfile = null;
let exercisePlan = [];
let currentDate = new Date();
let selectedPlan = null;
let isUpdatingFromFirebase = false; // Firebase 업데이트 중인지 확인

// Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyAlQzTfxwrlCqB0K700wjt-y7jkLlwzTbY",
    authDomain: "family-fitness-app.firebaseapp.com",
    projectId: "family-fitness-app",
    storageBucket: "family-fitness-app.firebasestorage.app",
    messagingSenderId: "780285798866",
    appId: "1:780285798866:web:22164aee6f3e600166800b",
    measurementId: "G-CQX45MBMCF"
};

// Firebase 초기화
let db = null;
let isFirebaseAvailable = false;
const FAMILY_CODE = "OUR_FAMILY_2024";

// Firebase 초기화 시도
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    isFirebaseAvailable = true;
    console.log("🔥 Firebase 연결 성공!");
} catch (error) {
    console.warn("⚠️ Firebase 연결 실패, 로컬 모드로 동작:", error);
    isFirebaseAvailable = false;
}

// 로컬 스토리지 키
const STORAGE_KEY = 'family_fitness_data';

// PWA 캐시 강제 업데이트 (모바일 앱에서 중요)
async function forceCacheUpdate() {
    console.log('🧹 강력한 캐시 정리 시작...');
    
    // 모든 캐시 강제 삭제
    if ('caches' in window) {
        try {
            const cacheNames = await caches.keys();
            console.log('발견된 캐시들:', cacheNames);
            
            await Promise.all(cacheNames.map(async (cacheName) => {
                await caches.delete(cacheName);
                console.log('❌ 캐시 삭제:', cacheName);
            }));
            
            console.log('✅ 모든 캐시 삭제 완료');
        } catch (error) {
            console.warn('⚠️ 캐시 삭제 실패:', error);
        }
    }
    
    // Service Worker 완전 재시작
    if ('serviceWorker' in navigator) {
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                console.log('🔄 Service Worker 재등록 중...');
                await registration.unregister();
                console.log('❌ Service Worker 등록 해제됨');
            }
            
            // 새로 등록
            setTimeout(async () => {
                try {
                    const newReg = await navigator.serviceWorker.register('./sw.js');
                    console.log('✅ Service Worker 새로 등록됨');
                } catch (error) {
                    console.warn('⚠️ Service Worker 재등록 실패:', error);
                }
            }, 1000);
            
        } catch (error) {
            console.warn('⚠️ Service Worker 처리 실패:', error);
        }
    }
    
    // 브라우저 캐시 무효화
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Cache-Control';
    meta.content = 'no-cache, no-store, must-revalidate';
    document.head.appendChild(meta);
    
    console.log('⏰ 캐시 버스팅 타임스탬프:', Date.now());
}

// 초기화
document.addEventListener('DOMContentLoaded', async function() {
    // 모바일/PWA에서 캐시 업데이트 먼저 실행
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isPWA = window.matchMedia('(display-mode: standalone)').matches;
    
    if (isMobile || isPWA) {
        console.log('📱 모바일/PWA 환경에서 캐시 업데이트 실행');
        await forceCacheUpdate();
    }
    
    await initializeApp();
});

// 캐시 강제 삭제 (개발/디버깅용)
async function clearAllCaches() {
    if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('모든 캐시 삭제 완료');
        
        // Service Worker 등록 해제 후 재등록
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(reg => reg.unregister()));
            console.log('Service Worker 등록 해제 완료');
            
            // 페이지 새로고침
            window.location.reload(true);
        }
    }
}

// 간단한 대체 이미지 (작고 가벼움)
const SIMPLE_FALLBACK = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnIj48c3RvcCBzdG9wLWNvbG9yPSIjNjY3ZWVhIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjNzY0YmEyIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9InVybCgjZykiLz48dGV4dCB4PSI1MCIgeT0iNTUiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj7Rgb7stZw8L3RleHQ+PC9zdmc+";

// 로딩 화면 배경 이미지 설정 (단순하고 가벼운 버전)
function setLoadingBackground() {
    const loadingScreen = document.getElementById('loading-screen');
    if (!loadingScreen) return;
    
    console.log('🖼️ 로딩 이미지 설정 시작 (단순 버전)');
    
    // 간단한 경로들만 시도
    const paths = [
        'https://mushs01.github.io/family_fitness/family_image.png',
        './family_image.png',
        'family_image.png'
    ];
    
    let imageFound = false;
    
    function tryPath(index) {
        if (index >= paths.length || imageFound) {
            if (!imageFound) {
                console.log('🎨 간단한 대체 이미지 사용');
                loadingScreen.style.backgroundImage = `url('${SIMPLE_FALLBACK}')`;
                loadingScreen.style.backgroundSize = 'cover';
                loadingScreen.style.backgroundPosition = 'center';
            }
            return;
        }
        
        const img = new Image();
        img.onload = function() {
            if (!imageFound) {
                imageFound = true;
                console.log('✅ 이미지 로드 성공:', paths[index]);
                loadingScreen.style.backgroundImage = `url('${this.src}')`;
                loadingScreen.style.backgroundSize = 'cover';
                loadingScreen.style.backgroundPosition = 'center';
                loadingScreen.style.backgroundRepeat = 'no-repeat';
            }
        };
        img.onerror = function() {
            console.log('❌ 실패:', paths[index]);
            tryPath(index + 1);
        };
        img.src = paths[index];
        
        // 1초 후 다음 경로 시도
        setTimeout(() => {
            if (!imageFound) {
                tryPath(index + 1);
            }
        }, 1000);
    }
    
    tryPath(0);
}

// 앱 초기화
async function initializeApp() {
    try {
        console.log('🚀 앱 초기화 시작');
        
        // 모바일 환경 감지 (먼저 정의)
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isPWA = window.matchMedia('(display-mode: standalone)').matches;
        console.log('📱 모바일 감지:', isMobile, 'PWA 모드:', isPWA);
        
        // 로딩 화면 표시
        showScreen('loading-screen');
        console.log('✅ 로딩 화면 표시됨');
        
        // 배경 이미지 설정
        setLoadingBackground();
        console.log('✅ 배경 이미지 설정 완료');
        
        // 로딩 상태 업데이트
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = 'Firebase 연결 중...';
            console.log('✅ 로딩 텍스트 업데이트됨');
        }
        
        // 데이터 로드
        console.log('📊 데이터 로드 시작...');
        await loadData();
        console.log('✅ 데이터 로드 완료');
        
        // 기존 계획들을 월별 데이터로 마이그레이션
        if (loadingText) {
            loadingText.textContent = '기존 데이터 마이그레이션 중...';
        }
        console.log('🔄 데이터 마이그레이션 시작...');
        await migrateExistingPlansToMonthly();
        console.log('✅ 데이터 마이그레이션 완료');
        
        // 월별 초기화 확인 (매월 1일)
        if (loadingText) {
            loadingText.textContent = '월별 랭킹 확인 중...';
        }
        console.log('🗓️ 월별 초기화 확인...');
        const wasReset = await checkAndPerformMonthlyReset();
        if (wasReset) {
            console.log('✅ 월별 초기화 완료');
        } else {
            console.log('✅ 월별 초기화 불필요');
        }
        
        // Firebase 실시간 동기화 설정
        console.log('🔥 Firebase 동기화 설정...');
        setupFirebaseSync();
        console.log('✅ Firebase 동기화 설정 완료');
        
        // 로딩 완료 - 텍스트 숨기기
        if (loadingText) {
            loadingText.style.display = 'none';
        }
        console.log('✅ 로딩 텍스트 숨김');
        
        // 이벤트 리스너 설정
        console.log('⚡ 이벤트 리스너 설정...');
        setupEventListeners();
        console.log('✅ 이벤트 리스너 설정 완료');
        
        // 모바일에서 더 안전한 화면 전환을 위한 다중 방법 사용
        let transitionCompleted = false;
        
        // 방법 1: 일반 setTimeout (3초)
        console.log('⏰ 3초 후 프로필 화면으로 이동 예약됨');
        const timeoutId = setTimeout(async () => {
            if (!transitionCompleted) {
                transitionCompleted = true;
                await performScreenTransition('timeout');
            }
        }, 3000);
        
        // 방법 2: 모바일에서 더 빠른 대안 (2초)
        if (isMobile || isPWA) {
            console.log('📱 모바일/PWA용 빠른 전환 타이머 설정 (2초)');
            setTimeout(async () => {
                if (!transitionCompleted) {
                    transitionCompleted = true;
                    clearTimeout(timeoutId);
                    await performScreenTransition('mobile-fast');
                }
            }, 2000);
        }
        
        // 방법 3: Page Visibility API로 포그라운드 복귀시 즉시 전환
        let visibilityTimer;
        const handleVisibilityChange = async () => {
            if (!document.hidden && !transitionCompleted) {
                console.log('👁️ 페이지가 포그라운드로 복귀 - 즉시 전환');
                transitionCompleted = true;
                clearTimeout(timeoutId);
                clearTimeout(visibilityTimer);
                await performScreenTransition('visibility');
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // 방법 4: 강제 전환 (10초 후 - 백업)
        setTimeout(async () => {
            if (!transitionCompleted) {
                console.log('🚨 강제 전환 실행 (10초 경과)');
                transitionCompleted = true;
                await performScreenTransition('force');
            }
        }, 10000);
        
        // 화면 전환 실행 함수
        async function performScreenTransition(method) {
            try {
                console.log(`🔄 프로필 화면으로 전환 시작 (${method} 방법)`);
                showScreen('profile-screen');
                console.log('✅ 프로필 화면 표시됨');
                
                // 모바일에서는 UI 업데이트를 나중에 처리
                if (isMobile || isPWA) {
                    setTimeout(async () => {
                        try {
                            console.log('📊 랭킹 업데이트 시작... (모바일 지연)');
                            await updateRanking();
                            console.log('✅ 랭킹 업데이트 완료');
                            
                            console.log('👥 프로필 카드 업데이트 시작... (모바일 지연)');
                            await updateProfileCards();
                            console.log('✅ 프로필 카드 업데이트 완료');
                            
                            console.log('🎉 앱 초기화 완전히 완료! (모바일)');
                        } catch (error) {
                            console.error('❌ 모바일 UI 업데이트 중 오류:', error);
                        }
                    }, 500);
                } else {
                    console.log('📊 랭킹 업데이트 시작...');
                    await updateRanking();
                    console.log('✅ 랭킹 업데이트 완료');
                    
                    console.log('👥 프로필 카드 업데이트 시작...');
                    await updateProfileCards();
                    console.log('✅ 프로필 카드 업데이트 완료');
                    
                    console.log('🎉 앱 초기화 완전히 완료!');
                }
                
                // 이벤트 리스너 정리
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                
            } catch (error) {
                console.error('❌ 프로필 화면 전환 중 오류:', error);
                // 오류 발생 시에도 프로필 화면으로 이동
                showScreen('profile-screen');
            }
        }
        
        console.log('✅ 앱 초기화 메인 단계 완료');
        
    } catch (error) {
        console.error('❌ 앱 초기화 중 치명적 오류:', error);
        
        // 오류 발생 시 사용자에게 알림
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = '오류가 발생했습니다. 잠시 후 다시 시도합니다...';
            loadingText.style.color = '#ff6b6b';
        }
        
        // 5초 후 강제로 프로필 화면으로 이동
        setTimeout(() => {
            console.log('🔄 오류 복구: 프로필 화면으로 강제 이동');
            showScreen('profile-screen');
        }, 5000);
    }
}

// Firebase 실시간 동기화 설정
function setupFirebaseSync() {
    if (!isFirebaseAvailable) {
        console.log("📱 로컬 모드로 동작");
        return;
    }
    
    // Firestore 실시간 리스너 설정
    db.collection('families').doc(FAMILY_CODE)
        .onSnapshot(async (doc) => {
            // 자신의 쓰기 작업으로 인한 업데이트는 무시
            if (doc.exists && doc.metadata.hasPendingWrites === false && !isUpdatingFromFirebase) {
                console.log("🔄 Firebase에서 실시간 데이터 수신");
                const firebaseData = doc.data();
                
                // 로컬 데이터와 Firebase 데이터 병합
                const mergedData = await mergeDataSafely(firebaseData);
                
                // 로컬 저장소 업데이트
                localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedData));
                
                // UI 업데이트 (Firebase 업데이트 중임을 표시)
                isUpdatingFromFirebase = true;
                
                // 현재 프로필이 있으면 UI 업데이트
                if (currentProfile) {
                    await updatePlansList();
                    await updateRanking();
                } else {
                    // 프로필 선택 화면에 있을 때도 업데이트
                    await updateRanking();
                    await updateProfileCards();
                }
                
                isUpdatingFromFirebase = false;
                showMessage("🔄 동기화 완료", true);
            }
        }, (error) => {
            console.warn("⚠️ Firebase 실시간 동기화 오류:", error);
            isUpdatingFromFirebase = false;
        });
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 프로필 카드 클릭
    document.querySelectorAll('.profile-card').forEach(card => {
        card.addEventListener('click', async function() {
            const profile = this.dataset.profile;
            await selectProfile(profile);
        });
    });
    

    
    // 뒤로 가기 버튼
    document.querySelector('.back-btn').addEventListener('click', async function() {
        showScreen('profile-screen');
        await updateRanking();
        await updateProfileCards();
    });
    
    // 탭 버튼 클릭 이벤트
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const tabName = this.dataset.tab;
            await switchTab(tabName);
        });
    });
    
    // 새 계획 추가 버튼
    document.querySelector('.add-plan-btn').addEventListener('click', function() {
        showAddPlanPopup();
    });
    
    // 팝업 닫기
    document.querySelector('.cancel-btn').addEventListener('click', function() {
        hideAddPlanPopup();
    });
    
    // 계획 저장 (기존 이벤트 리스너 제거 후 새로 등록)
    const planForm = document.getElementById('plan-form');
    if (planForm) {
        // 기존 이벤트 리스너 제거
        planForm.removeEventListener('submit', handlePlanSubmit);
        // 새 이벤트 리스너 등록
        planForm.addEventListener('submit', handlePlanSubmit);
    }
    
    function handlePlanSubmit(e) {
        e.preventDefault();
        console.log('폼 제출 이벤트 발생');
        console.log('현재 프로필:', currentProfile);
        savePlan();
    }
    
    // 정렬 드롭다운 이벤트 리스너
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        // 저장된 정렬 옵션 복원
        const savedSort = localStorage.getItem('plans-sort-preference');
        if (savedSort) {
            sortSelect.value = savedSort;
        }
        
        sortSelect.addEventListener('change', async function() {
            const sortBy = this.value;
            // 정렬 선택사항 저장
            localStorage.setItem('plans-sort-preference', sortBy);
            await updatePlansList(sortBy);
        });
    }
    
    // 캘린더 네비게이션 (단일 이벤트 리스너)
    document.querySelectorAll('.calendar-nav').forEach(btn => {
        btn.addEventListener('click', async function() {
            const direction = this.dataset.nav;
            await navigateMonth(direction);
        });
    });
    
    // 앱 종료 버튼
    document.querySelector('.exit-btn').addEventListener('click', async function() {
        if (confirm('정말로 앱을 종료하시겠습니까?')) {
            await exitApp();
        }
    });
    
    // 앱 정보 버튼
    document.querySelector('.info-btn').addEventListener('click', function() {
        showAppInfo();
    });
}

// 앱 종료 함수 (PWA/모바일 최적화 - 강화 버전)
async function exitApp() {
    try {
        console.log('🚪 앱 종료 프로세스 시작...');
        
        // 1. 즉시 사용자에게 선택권 제공
        const userChoice = confirm(
            '앱 종료 방법을 선택해주세요:\n\n' +
            '확인: 자동 종료 시도\n' +
            '취소: 수동 종료 안내'
        );
        
        // 2. 데이터 저장 (안전하게)
        try {
            const currentData = await loadData();
            if (currentData) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
                console.log('✅ 최종 데이터 저장 완료');
            }
        } catch (error) {
            console.warn('⚠️ 데이터 저장 실패:', error);
        }
        
        // 3. 세션 정리
        currentProfile = null;
        exercisePlan = [];
        selectedPlan = null;
        
        if (userChoice) {
            // 자동 종료 시도
            showMessage('앱을 종료 중입니다...', false);
            
            // 즉시 여러 방법 동시 시도
            const exitPromises = [];
            
            // 방법 1: window.close() (즉시)
            try {
                console.log('🚪 window.close() 즉시 시도');
                window.close();
            } catch (e) {}
            
            // 방법 2: 히스토리 조작 (즉시)
            try {
                if (window.history.length > 1) {
                    console.log('📱 히스토리 뒤로 가기');
                    window.history.go(-window.history.length + 1);
                    window.history.back();
                }
            } catch (e) {}
            
            // 방법 3: location 조작들 (순차적)
            setTimeout(() => {
                try {
                    console.log('🔄 location.replace 시도');
                    window.location.replace('about:blank');
                } catch (e) {}
            }, 500);
            
            setTimeout(() => {
                try {
                    console.log('🔄 location.href 시도');
                    window.location.href = 'javascript:void(0);';
                } catch (e) {}
            }, 1000);
            
            setTimeout(() => {
                try {
                    console.log('🔄 빈 페이지 로드');
                    document.open();
                    document.write('');
                    document.close();
                } catch (e) {}
            }, 1500);
            
            // 방법 4: Android 특화
            setTimeout(() => {
                try {
                    if (navigator.app && navigator.app.exitApp) {
                        console.log('📱 Android exitApp() 시도');
                        navigator.app.exitApp();
                    }
                    
                    // Cordova/PhoneGap 지원
                    if (window.device && navigator.app) {
                        navigator.app.exitApp();
                    }
                } catch (e) {}
            }, 2000);
            
            // 방법 5: 강제 언로드
            setTimeout(() => {
                try {
                    console.log('🚫 강제 언로드');
                    window.location = 'javascript:window.close();';
                } catch (e) {}
            }, 2500);
            
            // 최종 안내
            setTimeout(() => {
                alert(
                    '자동 종료에 실패했습니다.\n\n' +
                    '📱 Android: 홈 버튼 → 최근 앱에서 스와이프\n' +
                    '🍎 iOS: 홈 버튼 두 번 누르고 위로 스와이프\n' +
                    '💻 PC: 브라우저 탭 닫기 (Ctrl+W)'
                );
            }, 3000);
            
        } else {
            // 수동 종료 안내
            const userAgent = navigator.userAgent.toLowerCase();
            let instructions = '';
            
            if (userAgent.includes('android')) {
                instructions = 
                    '📱 Android 앱 종료 방법:\n\n' +
                    '1. 홈 버튼을 누르세요\n' +
                    '2. 최근 앱 버튼을 누르세요\n' +
                    '3. 이 앱을 위로 스와이프하세요\n\n' +
                    '또는 뒤로 가기 버튼을 여러 번 누르세요';
            } else if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
                instructions = 
                    '🍎 iOS 앱 종료 방법:\n\n' +
                    '1. 홈 버튼을 두 번 빠르게 누르세요\n' +
                    '   (또는 화면 하단에서 위로 스와이프)\n' +
                    '2. 이 앱을 위로 스와이프하세요';
            } else {
                instructions = 
                    '💻 PC 브라우저 종료 방법:\n\n' +
                    '1. Ctrl + W (탭 닫기)\n' +
                    '2. Alt + F4 (창 닫기)\n' +
                    '3. 브라우저 X 버튼 클릭';
            }
            
            alert(instructions);
        }
        
    } catch (error) {
        console.error('❌ 앱 종료 프로세스 실패:', error);
        alert(
            '앱 종료 오류가 발생했습니다.\n' +
            '홈 버튼을 눌러 앱을 종료해주세요.'
        );
    }
}

// 화면 전환
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// 프로필 선택
async function selectProfile(profileName) {
    currentProfile = profileName;
    
    // 현재 프로필 정보 업데이트
    await updateCurrentProfileInfo();
    
    // 운동 관리 화면으로 이동
    showScreen('exercise-screen');
    
    // 계획 목록 업데이트
    await updatePlansList();
    
    // 정렬 드롭다운 초기화 (저장된 설정 적용)
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        const savedSort = localStorage.getItem('plans-sort-preference');
        if (savedSort) {
            sortSelect.value = savedSort;
        }
    }
    
    // 캘린더 초기화 (첫 방문 시에도 제대로 표시되도록)
    currentDate = new Date();
    await updateCalendar();
}

// 현재 프로필 정보 업데이트
async function updateCurrentProfileInfo() {
    const profileData = await getProfileData(currentProfile);
    const imgSrc = getProfileImageSrc(currentProfile);
    
    document.getElementById('current-profile-img').src = imgSrc;
    document.getElementById('current-profile-name').textContent = `${currentProfile}님`;
    document.getElementById('current-profile-grade').textContent = profileData.grade;
}

// 프로필 이미지 경로 가져오기
function getProfileImageSrc(profileName) {
    const imageMap = {
        '아빠': 'dad.png',
        '엄마': 'mom.png',
        '주환': 'juhwan.png',
        '태환': 'taehwan.png'
    };
    return imageMap[profileName] || 'icon.png';
}



// 탭 전환
async function switchTab(tabName) {
    // 탭 버튼 활성화
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // 탭 내용 표시
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    if (tabName === 'calendar') {
        await updateCalendar();
    } else {
        // 다른 탭으로 전환할 때 선택된 계획 초기화 (계획에서 직접 호출된 경우 제외)
        if (tabName !== 'calendar') {
            selectedPlan = null;
        }
    }
}

// 새 계획 추가 팝업 표시
function showAddPlanPopup() {
    document.getElementById('add-plan-popup').classList.add('active');
    
    // 현재 날짜로 초기화
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('start-date').value = today;
    document.getElementById('end-date').value = today;
}

// 팝업 숨기기
function hideAddPlanPopup() {
    document.getElementById('add-plan-popup').classList.remove('active');
    document.getElementById('plan-form').reset();
}

// 계획 저장
async function savePlan() {
    try {
        const exerciseType = document.getElementById('exercise-type').value;
        const exerciseContent = document.getElementById('exercise-content').value;
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        
        // 필수 필드 검증
        if (!exerciseType || !exerciseContent || !startDate || !endDate) {
            alert('모든 필드를 입력해주세요.');
            return;
        }
        
        // 날짜 검증
        if (new Date(startDate) > new Date(endDate)) {
            alert('시작 날짜는 종료 날짜보다 빨라야 합니다.');
            return;
        }
        
        const plan = {
            id: Date.now(),
            exercise_type: exerciseType,
            exercise_content: exerciseContent,
            start_date: startDate,
            end_date: endDate,
            completed_dates: [],
            created_date: new Date().toLocaleString('ko-KR')
        };
        
        console.log('새 계획 생성:', plan);
    
    // 데이터 저장
    const data = await loadData();
    if (!data.profiles[currentProfile]) {
        data.profiles[currentProfile] = { 
            exercisePlans: [], 
            monthlyData: {},
            score: 0, 
            completedCount: 0 
        };
    }
    
    // 기존 exercisePlans에도 저장 (하위 호환성)
    data.profiles[currentProfile].exercisePlans.push(plan);
    
            // 현재 월별 데이터에도 저장
        const currentMonth = getCurrentMonthKey();
        console.log('현재 월:', currentMonth);
        const monthlyData = getMonthlyData(data.profiles[currentProfile], currentMonth);
        console.log('월별 데이터:', monthlyData);
        monthlyData.exercisePlans.push(plan);
        console.log('계획 추가 후 월별 데이터:', monthlyData);
        console.log('데이터 저장 시작');
        await saveData(data);
        console.log('데이터 저장 완료');
        
        // UI 업데이트
        console.log('UI 업데이트 시작');
        await updatePlansList();
        console.log('계획 목록 업데이트 완료');
        await updateRanking();
        console.log('랭킹 업데이트 완료');
        hideAddPlanPopup();
        console.log('팝업 숨김 완료');
    
        // Firebase 연결 상태에 따른 메시지
        if (isFirebaseAvailable) {
            showMessage('🔥 새 운동 계획이 가족에게 공유되었습니다!');
        } else {
            showMessage('📱 새 운동 계획이 추가되었습니다! (로컬 저장)');
        }
        
        console.log('운동계획 저장 완료:', plan);
        
    } catch (error) {
        console.error('계획 저장 중 오류:', error);
        alert('계획 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
}

// 계획 목록 업데이트
async function updatePlansList(sortBy = null) {
    // sortBy가 제공되지 않으면 저장된 설정이나 기본값 사용
    if (!sortBy) {
        sortBy = localStorage.getItem('plans-sort-preference') || 'start-date-asc';
    }
    const data = await loadData();
    const profileData = data.profiles[currentProfile] || { exercisePlans: [] };
    const plansList = document.getElementById('plans-list');
    
    plansList.innerHTML = '';
    
    if (profileData.exercisePlans.length === 0) {
        plansList.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 40px; color: black; background: rgba(255,255,255,0.1); border-radius: 10px;">
                <p style="font-size: 1.2rem; margin-bottom: 10px;">아직 운동 계획이 없습니다.</p>
                <p style="font-size: 1rem;">새 계획을 추가해보세요! 💪</p>
            </div>
        `;
        
        // 계획 개수 표시 업데이트
        const plansCount = document.getElementById('plans-count');
        if (plansCount) {
            plansCount.textContent = '0개 계획';
        }
        return;
    }
    
    // 오늘 날짜 계산
    const today = new Date().toISOString().split('T')[0];
    
    // 현재 및 미래 계획만 필터링 (지난 계획 제외)
    const activePlans = profileData.exercisePlans.filter(plan => {
        return plan.end_date >= today;
    });
    
    // 필터링된 계획이 없는 경우
    if (activePlans.length === 0) {
        plansList.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 40px; color: black; background: rgba(255,255,255,0.1); border-radius: 10px;">
                <p style="font-size: 1.2rem; margin-bottom: 10px;">현재 진행 중인 운동 계획이 없습니다.</p>
                <p style="font-size: 1rem;">새 계획을 추가해보세요! 💪</p>
            </div>
        `;
        
        // 계획 개수 표시 업데이트 (필터링된 개수)
        const plansCount = document.getElementById('plans-count');
        if (plansCount) {
            plansCount.textContent = '0개 계획';
        }
        return;
    }
    
    // 계획 개수 표시 업데이트 (필터링된 개수)
    const plansCount = document.getElementById('plans-count');
    if (plansCount) {
        plansCount.textContent = `${activePlans.length}개 계획`;
    }
    
    // 정렬 드롭다운 값 동기화
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect && sortSelect.value !== sortBy) {
        sortSelect.value = sortBy;
    }
    
    // 정렬된 계획들 표시
    const sortedPlans = sortPlans(activePlans, sortBy);
    sortedPlans.forEach(plan => {
        const planElement = createPlanElement(plan);
        plansList.appendChild(planElement);
    });
}

// 계획 정렬 함수
function sortPlans(plans, sortBy) {
    const plansCopy = [...plans]; // 원본 배열 보호
    
    switch (sortBy) {
        case 'start-date-asc':
            return plansCopy.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
            
        case 'start-date-desc':
            return plansCopy.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
            
        case 'end-date-asc':
            return plansCopy.sort((a, b) => new Date(a.end_date) - new Date(b.end_date));
            
        case 'end-date-desc':
            return plansCopy.sort((a, b) => new Date(b.end_date) - new Date(a.end_date));
            
        case 'created-date-desc':
            return plansCopy.sort((a, b) => {
                // created_date가 문자열 형태로 저장되어 있어서 id로 대체 (더 최근 id가 더 큰 숫자)
                return (b.id || 0) - (a.id || 0);
            });
            
        case 'created-date-asc':
            return plansCopy.sort((a, b) => {
                return (a.id || 0) - (b.id || 0);
            });
            
        case 'progress-desc':
            return plansCopy.sort((a, b) => {
                const progressA = calculateProgress(a);
                const progressB = calculateProgress(b);
                return progressB - progressA;
            });
            
        case 'progress-asc':
            return plansCopy.sort((a, b) => {
                const progressA = calculateProgress(a);
                const progressB = calculateProgress(b);
                return progressA - progressB;
            });
            
        case 'type':
            return plansCopy.sort((a, b) => {
                // 운동 종류별로 정렬하고, 같은 종류면 시작일로 정렬
                if (a.exercise_type === b.exercise_type) {
                    return new Date(a.start_date) - new Date(b.start_date);
                }
                return a.exercise_type.localeCompare(b.exercise_type, 'ko');
            });
            
        default:
            return plansCopy.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    }
}

// 계획의 진행률 계산 (퍼센트)
function calculateProgress(plan) {
    const completedCount = plan.completed_dates ? plan.completed_dates.length : 0;
    const totalDays = calculateDaysBetween(plan.start_date, plan.end_date) + 1;
    return totalDays > 0 ? Math.round((completedCount / totalDays) * 100) : 0;
}

// 계획 요소 생성
function createPlanElement(plan) {
    const element = document.createElement('div');
    element.className = 'plan-item';
    
    const completedCount = plan.completed_dates ? plan.completed_dates.length : 0;
    const totalDays = calculateDaysBetween(plan.start_date, plan.end_date) + 1;
    const progressPercent = Math.round((completedCount / totalDays) * 100);
    
    // 오늘 날짜가 계획 기간에 포함되는지 확인
    const today = new Date().toISOString().split('T')[0];
    const isInPeriod = today >= plan.start_date && today <= plan.end_date;
    const isCompletedToday = plan.completed_dates && plan.completed_dates.includes(today);
    
    element.innerHTML = `
        <div class="plan-header">
            <span class="plan-type">${plan.exercise_type}</span>
            <button class="plan-menu-btn" data-plan-id="${plan.id}" style="background:none; border:none; font-size:1.2rem; cursor:pointer;">⋮</button>
        </div>
        <div class="plan-content">${plan.exercise_content}</div>
        <div class="plan-dates">${plan.start_date} ~ ${plan.end_date}</div>
        <div class="plan-progress" data-plan-id="${plan.id}" style="cursor: pointer; padding: 5px; border-radius: 4px; transition: background-color 0.2s; ${isInPeriod ? 'background-color: #f0f8ff;' : 'background-color: #f5f5f5;'}" 
             title="${isInPeriod ? (isCompletedToday ? '클릭하여 오늘 완료 취소' : '클릭하여 오늘 완료 처리') : '계획 기간이 아닙니다'}">
            완료: ${completedCount}/${totalDays}일 (${progressPercent}%) ${isInPeriod ? (isCompletedToday ? '✅' : '⭕') : '⏸️'}
        </div>
        ${isInPeriod ? `
        <div class="plan-actions" style="margin-top: 10px; text-align: center;">
            <button class="complete-btn" data-plan-id="${plan.id}" 
                    style="background: ${isCompletedToday ? '#4caf50' : '#2196f3'}; 
                           color: white; border: none; padding: 8px 16px; 
                           border-radius: 5px; cursor: pointer; font-size: 0.9rem;">
                ${isCompletedToday ? '✅ 완료됨' : '💪 오늘 완료하기'}
            </button>
        </div>
        ` : ''}
    `;
    
    // 완료 버튼 이벤트 추가
    const completeBtn = element.querySelector('.complete-btn');
    if (completeBtn) {
        completeBtn.addEventListener('click', async function(e) {
            e.stopPropagation(); // 부모 클릭 이벤트 방지
            const planId = parseInt(this.dataset.planId);
            await toggleExerciseCompletion(planId);
        });
    }
    
    // 메뉴 버튼 이벤트 추가 (삭제 기능)
    const menuBtn = element.querySelector('.plan-menu-btn');
    if (menuBtn) {
        menuBtn.addEventListener('click', async function(e) {
            e.stopPropagation(); // 부모 클릭 이벤트 방지
            const planId = parseInt(this.dataset.planId);
            await showPlanDeleteConfirm(planId, plan);
        });
    }
    
    // 진행률 클릭 이벤트 추가 (완료/취소 처리)
    const progressElement = element.querySelector('.plan-progress');
    if (progressElement) {
        progressElement.addEventListener('click', async function(e) {
            e.stopPropagation(); // 부모 클릭 이벤트 방지
            
            // 계획 기간에 포함되는 경우에만 완료/취소 처리
            if (isInPeriod) {
                const planId = parseInt(this.dataset.planId);
                await toggleExerciseCompletion(planId);
            } else {
                alert('해당 계획의 기간이 아닙니다.');
            }
        });
    }
    
    // 계획 카드 클릭 이벤트 (완료 버튼, 진행률, 메뉴 버튼 제외)
    element.addEventListener('click', async function(e) {
        if (!e.target.classList.contains('complete-btn') && 
            !e.target.classList.contains('plan-progress') && 
            !e.target.classList.contains('plan-menu-btn')) {
            await showPlanCalendar(plan);
        }
    });
    
    return element;
}

// 운동계획 삭제 확인 팝업
async function showPlanDeleteConfirm(planId, plan) {
    const confirmMessage = `운동계획을 삭제하시겠습니까?\n\n${plan.exercise_type}: ${plan.exercise_content}\n기간: ${plan.start_date} ~ ${plan.end_date}\n\n⚠️ 삭제하면 계획 점수(-1점)가 차감됩니다.`;
    
    if (confirm(confirmMessage)) {
        await deletePlan(planId);
    }
}

// 운동계획 삭제 함수
async function deletePlan(planId) {
    try {
        const data = await loadData();
        const profileData = data.profiles[currentProfile];
        
        if (!profileData || !profileData.exercisePlans) {
            console.error('프로필 데이터가 없습니다.');
            return;
        }
        
        // 기존 exercisePlans에서 삭제
        const planIndex = profileData.exercisePlans.findIndex(plan => plan.id === planId);
        if (planIndex === -1) {
            console.error('삭제할 계획을 찾을 수 없습니다.');
            return;
        }
        
        profileData.exercisePlans.splice(planIndex, 1);
        
        // 월별 데이터에서도 삭제
        const currentMonth = getCurrentMonthKey();
        const monthlyData = getMonthlyData(profileData, currentMonth);
        if (monthlyData.exercisePlans) {
            const monthlyPlanIndex = monthlyData.exercisePlans.findIndex(plan => plan.id === planId);
            if (monthlyPlanIndex !== -1) {
                monthlyData.exercisePlans.splice(monthlyPlanIndex, 1);
            }
        }
        
        // 데이터 저장
        await saveData(data);
        
        // UI 업데이트
        await updatePlansList();
        await updateRanking();
        
        console.log('운동계획이 삭제되었습니다.');
        
    } catch (error) {
        console.error('계획 삭제 중 오류:', error);
        alert('계획 삭제 중 오류가 발생했습니다.');
    }
}

// 운동 완료 토글
async function toggleExerciseCompletion(planId) {
    const data = await loadData();
    const profileData = data.profiles[currentProfile];
    
    if (!profileData || !profileData.exercisePlans) {
        showMessage('❌ 프로필 데이터를 찾을 수 없습니다.');
        return;
    }
    
    const plan = profileData.exercisePlans.find(p => p.id === planId);
    if (!plan) {
        showMessage('❌ 운동 계획을 찾을 수 없습니다.');
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // completed_dates 배열이 없으면 생성
    if (!plan.completed_dates) {
        plan.completed_dates = [];
    }
    
    // 오늘 날짜가 이미 완료되었는지 확인
    const todayIndex = plan.completed_dates.indexOf(today);
    const exerciseScore = getExerciseScore(plan.exercise_type);
    
    if (todayIndex > -1) {
        // 이미 완료된 경우 - 완료 취소
        plan.completed_dates.splice(todayIndex, 1);
        await saveData(data);
        
        if (isFirebaseAvailable) {
            showMessage(`🔄 ${plan.exercise_type} 완료를 취소했습니다! (-${exerciseScore}점)`);
        } else {
            showMessage(`📱 ${plan.exercise_type} 완료를 취소했습니다! (-${exerciseScore}점)`);
        }
    } else {
        // 완료되지 않은 경우 - 완료 처리
        plan.completed_dates.push(today);
        await saveData(data);
        
        if (isFirebaseAvailable) {
            showMessage(`🎉 ${plan.exercise_type} 완료! +${exerciseScore}점 획득! 가족에게 공유되었습니다!`);
        } else {
            showMessage(`🎉 ${plan.exercise_type} 완료! +${exerciseScore}점 획득!`);
        }
    }
    
    // UI 업데이트
    await updatePlansList();
    await updateRanking();
    await updateCurrentProfileInfo();
}

// 계획별 캘린더 표시
async function showPlanCalendar(plan) {
    // 선택된 계획 저장
    selectedPlan = plan;
    
    // 계획 시작 날짜의 달로 캘린더 이동
    const startDate = new Date(plan.start_date);
    currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    
    // 캘린더 탭으로 전환
    await switchTab('calendar');
    
    // 계획 정보 표시
    const completedCount = plan.completed_dates ? plan.completed_dates.length : 0;
    const totalDays = calculateDaysBetween(plan.start_date, plan.end_date) + 1;
    const progressPercent = Math.round((completedCount / totalDays) * 100);
    
    showMessage(`📅 ${plan.exercise_type} 계획 (${plan.start_date} ~ ${plan.end_date})<br>
                💪 진행률: ${completedCount}/${totalDays}일 (${progressPercent}%)<br>
                ✨ 캘린더에서 날짜를 클릭하여 완료 체크!`);
}

// 캘린더 업데이트
async function updateCalendar() {
    const calendarTitle = document.getElementById('calendar-title');
    const calendarGrid = document.getElementById('calendar-grid');
    
    if (!calendarTitle || !calendarGrid) {
        console.error('캘린더 DOM 요소를 찾을 수 없습니다!');
        return;
    }
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    calendarTitle.textContent = `${year}년 ${month + 1}월`;
    
    // 캘린더 그리드 생성
    calendarGrid.innerHTML = await createCalendarGrid(year, month);
    
    // 캘린더 일자 클릭 이벤트 리스너 추가
    const calendarDays = calendarGrid.querySelectorAll('.calendar-day:not(.empty)');
    calendarDays.forEach(day => {
        day.addEventListener('click', async function() {
            const dateStr = this.dataset.date;
            if (dateStr) {
                await toggleDateCompletion(dateStr);
            }
        });
    });
}

// 캘린더 월 네비게이션
async function navigateMonth(direction) {
    if (direction === 'prev') {
        currentDate.setMonth(currentDate.getMonth() - 1);
    } else if (direction === 'next') {
        currentDate.setMonth(currentDate.getMonth() + 1);
    }
    await updateCalendar();
}

// 캘린더 그리드 생성
async function createCalendarGrid(year, month) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let html = `
        <style>
            .calendar-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; margin-bottom: 10px; }
            .calendar-weekdays > div { text-align: center; font-weight: bold; padding: 10px; background: #f0f0f0; border-radius: 5px; }
            .calendar-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; }
            .calendar-day { text-align: center; padding: 15px 5px; border-radius: 5px; cursor: pointer; transition: all 0.3s; }
            .calendar-day:hover { background: #e3f2fd; }
            .calendar-day.empty { visibility: hidden; }
            .calendar-day.has-exercise { background: #ffecb3; border: 2px solid #ffc107; }
            .calendar-day.completed { background: #c8e6c9; border: 2px solid #4caf50; color: #2e7d32; font-weight: bold; }
            .calendar-day.selected-plan { background: #e1f5fe; border: 3px solid #00bcd4; color: #006064; font-weight: bold; box-shadow: 0 2px 8px rgba(0,188,212,0.3); }
            .calendar-day.selected-completed { background: #a5d6a7; border: 3px solid #00e676; color: #1b5e20; font-weight: bold; box-shadow: 0 2px 8px rgba(0,230,118,0.4); }
        </style>
        <div class="calendar-weekdays">
            <div>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div>
        </div>
        <div class="calendar-days">
    `;
    
    // 빈 칸 추가
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="calendar-day empty"></div>';
    }
    
    // 날짜 추가
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isCompleted = await isDateCompleted(dateStr);
        const hasExercise = await hasExerciseOnDate(dateStr);
        
        // 선택된 계획의 기간인지 확인
        const isSelectedPlan = selectedPlan && 
                              dateStr >= selectedPlan.start_date && 
                              dateStr <= selectedPlan.end_date;
        
        // 선택된 계획에서 완료된 날짜인지 확인
        const isSelectedPlanCompleted = selectedPlan && 
                                       selectedPlan.completed_dates && 
                                       selectedPlan.completed_dates.includes(dateStr);
        
        const extraClasses = [];
        if (isCompleted) extraClasses.push('completed');
        if (hasExercise) extraClasses.push('has-exercise');
        if (isSelectedPlan) extraClasses.push('selected-plan');
        if (isSelectedPlanCompleted) extraClasses.push('selected-completed');
        
        html += `
            <div class="calendar-day ${extraClasses.join(' ')}" 
                 data-date="${dateStr}">
                ${day}
                ${isSelectedPlanCompleted ? '<br>🎯✅' : 
                  (isCompleted ? '<br>✅' : 
                   (isSelectedPlan ? '<br>🎯' : 
                    (hasExercise ? '<br>📅' : '')))}
            </div>
        `;
    }
    
    html += '</div>';
    return html;
}

// 특정 날짜에 완료된 운동이 있는지 확인
async function isDateCompleted(dateStr) {
    try {
        if (!currentProfile) return false;
        
        const data = await loadData();
        if (!data || !data.profiles) return false;
        
        const profileData = data.profiles[currentProfile];
        if (!profileData || !profileData.exercisePlans) return false;
        
        return profileData.exercisePlans.some(plan => {
            return plan.completed_dates && plan.completed_dates.includes(dateStr);
        });
    } catch (error) {
        console.error('isDateCompleted 에러:', error);
        return false;
    }
}

// 특정 날짜에 운동 계획이 있는지 확인
async function hasExerciseOnDate(dateStr) {
    try {
        if (!currentProfile) return false;
        
        const data = await loadData();
        if (!data || !data.profiles) return false;
        
        const profileData = data.profiles[currentProfile];
        if (!profileData || !profileData.exercisePlans) return false;
        
        return profileData.exercisePlans.some(plan => {
            return dateStr >= plan.start_date && dateStr <= plan.end_date;
        });
    } catch (error) {
        console.error('hasExerciseOnDate 에러:', error);
        return false;
    }
}

// 날짜 완료 토글
async function toggleDateCompletion(dateStr) {
    const data = await loadData();
    if (!data.profiles[currentProfile]) {
        data.profiles[currentProfile] = { exercisePlans: [] };
    }
    
    const profileData = data.profiles[currentProfile];
    if (!profileData.exercisePlans) {
        profileData.exercisePlans = [];
    }
    
    let dateToggled = false;
    
    profileData.exercisePlans.forEach(plan => {
        // 날짜가 계획 범위 내에 있는지 확인
        if (dateStr >= plan.start_date && dateStr <= plan.end_date) {
            if (!plan.completed_dates) plan.completed_dates = [];
            
            const dateIndex = plan.completed_dates.indexOf(dateStr);
            if (dateIndex > -1) {
                // 완료 취소
                plan.completed_dates.splice(dateIndex, 1);
                showMessage(`${dateStr} 운동 완료를 취소했습니다.`);
            } else {
                // 완료 체크
                plan.completed_dates.push(dateStr);
                showMessage(`${dateStr} 운동을 완료했습니다! 🎉`);
            }
            dateToggled = true;
        }
    });
    
    if (!dateToggled) {
        showMessage('해당 날짜에 운동 계획이 없습니다.');
        return;
    }
    
    await saveData(data);
    await updateCalendar();
    await updateCurrentProfileInfo();
    await updateRanking();
}



// 랭킹 업데이트
async function updateRanking() {
    
    const data = await loadData();
    const rankings = [];
    
    // 기본 프로필들 추가
    const profiles = ['아빠', '엄마', '주환', '태환'];
    for (const profile of profiles) {
        const score = calculateProfileScore(profile, data.profiles[profile]);
        const profileData = await getProfileData(profile);
        rankings.push({ 
            name: profile, 
            score: score,
            grade: profileData.grade 
        });
    }
    
    rankings.sort((a, b) => b.score - a.score);
    
    const rankingList = document.getElementById('ranking-list');
    rankingList.innerHTML = '';
    
    // 실제 등수 계산 (같은 점수면 같은 등수)
    let currentRank = 1;
    let previousScore = null;
    
    rankings.forEach((item, index) => {
        const rankingItem = document.createElement('div');
        rankingItem.className = 'ranking-item';
        
        // 같은 점수가 아니면 등수 업데이트
        if (previousScore !== null && item.score !== previousScore) {
            currentRank = index + 1;
        }
        previousScore = item.score;
        
        const rankNumber = currentRank;
        const imgSrc = getProfileImageSrc(item.name);
        
        // 실제 등수에 따른 배경색과 테두리색 (1위는 여러 명일 수 있음)
        let bgColor = '#f8f9fa';
        let borderColor = '#4CAF50'; // 기본색
        
        if (currentRank === 1) {
            bgColor = '#fff3cd'; // 1위 - 골드
            borderColor = '#FFD700';
        } else if (currentRank === 2) {
            bgColor = '#e2e3e5'; // 2위 - 실버
            borderColor = '#C0C0C0';
        } else if (currentRank === 3) {
            bgColor = '#f8d7da'; // 3위 - 브론즈
            borderColor = '#CD7F32';
        }
        
        rankingItem.innerHTML = `
            <div class="rank-profile-container" style="display: flex; flex-direction: column; align-items: center; text-align: center;">
                <div class="rank-image-wrapper" style="position: relative; margin-bottom: 8px;">
                    <img src="${imgSrc}" alt="${item.name}" 
                         style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 3px solid ${borderColor}; box-shadow: 0 4px 8px rgba(0,0,0,0.2);"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                    <div style="display: none; width: 60px; height: 60px; border-radius: 50%; background: #007bff; color: white; justify-content: center; align-items: center; font-size: 1.5rem; border: 3px solid ${borderColor};">
                        ${item.name === '아빠' ? '👨' : item.name === '엄마' ? '👩' : item.name === '주환' ? '👦' : '🧒'}
                    </div>
                    <div class="rank-badge" style="position: absolute; top: -5px; left: -5px; width: 25px; height: 25px; background: ${borderColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.8rem; color: white; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                        ${rankNumber}
                    </div>
                    <div class="grade-badge" style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.6rem; font-weight: bold; border: 1px solid white;">
                        ${item.grade.split(' ')[0]}
                    </div>
                </div>
                <div class="rank-info" style="text-align: center;">
                    <div style="font-weight: bold; font-size: 0.9rem; color: #333; margin-bottom: 2px;">
                        ${item.name}
                    </div>
                    <div style="font-size: 0.8rem; color: #666;">
                        ${item.score}점
                    </div>
                </div>
            </div>
        `;
        
        rankingList.appendChild(rankingItem);
    });
}

// 프로필 카드 정보 업데이트 
async function updateProfileCards() {
    const profiles = ['아빠', '엄마', '주환', '태환'];
    
    for (const profileName of profiles) {
        const profileData = await getProfileData(profileName);
        const profileCard = document.querySelector(`[data-profile="${profileName}"]`);
        
        if (profileCard) {
            const gradeElement = profileCard.querySelector('.grade');
            const scoreElement = profileCard.querySelector('.score');
            
            if (gradeElement) gradeElement.textContent = profileData.grade;
            if (scoreElement) scoreElement.textContent = `${profileData.score}점`;
        }
    }
}

// 프로필 점수 계산 (현재 월 기준)
function calculateProfileScore(profileName, profileData) {
    if (!profileData) return 0;
    
    const currentMonth = getCurrentMonthKey();
    const currentDate = new Date().toISOString().split('T')[0];
    
    // 현재 월의 활성 계획들만 사용
    let completionScore = 0;
    let planScore = 0;
    
    // 현재 운영 중인 계획들 (전체 exercisePlans에서)
    if (profileData.exercisePlans && Array.isArray(profileData.exercisePlans)) {
        const activePlans = profileData.exercisePlans.filter(plan => {
            // 현재 날짜 기준으로 아직 종료되지 않은 계획들
            return plan.end_date >= currentDate;
        });
        
        activePlans.forEach(plan => {
            // 이번 달에 완료된 운동만 점수 계산
            if (plan.completed_dates && Array.isArray(plan.completed_dates)) {
                const thisMonthCompletions = plan.completed_dates.filter(date => {
                    return date.startsWith(currentMonth.slice(0, 7)); // YYYY-MM 형식으로 비교
                });
                completionScore += thisMonthCompletions.length * getExerciseScore(plan.exercise_type);
            }
        });
        
        // 계획 보너스 점수 (활성 계획 1개당 1점)
        planScore = activePlans.length;
    }
    
    // 월별 데이터에서 추가 계획 점수 (하위 호환성)
    const monthlyData = getMonthlyData(profileData, currentMonth);
    if (monthlyData.exercisePlans && Array.isArray(monthlyData.exercisePlans)) {
        // 중복 제거: 이미 활성 계획에 포함되지 않은 추가 계획들만
        const additionalPlans = monthlyData.exercisePlans.filter(monthlyPlan => {
            const isInActivePlans = profileData.exercisePlans && 
                profileData.exercisePlans.some(activePlan => activePlan.id === monthlyPlan.id);
            return !isInActivePlans;
        });
        planScore += additionalPlans.length;
    }
    
    console.log(`${profileName} 점수 계산: 완료점수(${completionScore}) + 계획점수(${planScore}) = ${completionScore + planScore}`);
    
    return completionScore + planScore;
}

// 현재 월 키 생성 (예: "2025-01")
function getCurrentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// 월별 데이터 가져오기/생성
function getMonthlyData(profileData, monthKey) {
    if (!profileData.monthlyData) {
        profileData.monthlyData = {};
    }
    
    if (!profileData.monthlyData[monthKey]) {
        profileData.monthlyData[monthKey] = {
            exercisePlans: [],
            score: 0,
            completedCount: 0
        };
    }
    
    return profileData.monthlyData[monthKey];
}

// 월별 랭킹 초기화 확인 및 처리
async function checkAndPerformMonthlyReset() {
    const now = new Date();
    const currentMonth = getCurrentMonthKey();
    const currentDate = now.getDate();
    
    // 매월 1일에만 초기화 실행
    if (currentDate !== 1) {
        return false;
    }
    
    const lastResetMonth = localStorage.getItem('lastResetMonth');
    
    // 이번 달에 이미 초기화했는지 확인
    if (lastResetMonth === currentMonth) {
        return false;
    }
    
    console.log(`🗓️ 새로운 달 시작: ${currentMonth}, 월별 랭킹 초기화 시작...`);
    
    try {
        // 데이터 로드
        const data = await loadData();
        let hasChanges = false;
        
        // 모든 프로필의 이전 달 데이터 정리
        const profiles = ['아빠', '엄마', '주환', '태환'];
        for (const profileName of profiles) {
            const profileData = data.profiles[profileName];
            if (!profileData) continue;
            
            // 이전 달 계획들을 completed 상태로 이동 (기록 보존)
            if (profileData.exercisePlans && profileData.exercisePlans.length > 0) {
                const yesterday = new Date(now);
                yesterday.setDate(0); // 이전 달 마지막 날
                const previousMonth = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}`;
                
                // 이전 달에 종료된 계획들을 완료된 계획으로 이동
                const expiredPlans = profileData.exercisePlans.filter(plan => 
                    plan.end_date < currentMonth.slice(0, 7) + '-01' // 이번 달 1일보다 이전에 종료
                );
                
                if (expiredPlans.length > 0) {
                    // 이전 달 월별 데이터에 완료된 계획들 저장
                    const previousMonthData = getMonthlyData(profileData, previousMonth);
                    expiredPlans.forEach(plan => {
                        const exists = previousMonthData.exercisePlans.find(p => p.id === plan.id);
                        if (!exists) {
                            previousMonthData.exercisePlans.push(plan);
                        }
                    });
                    
                    // 현재 계획 목록에서 만료된 계획들 제거
                    profileData.exercisePlans = profileData.exercisePlans.filter(plan => 
                        plan.end_date >= currentMonth.slice(0, 7) + '-01'
                    );
                    
                    hasChanges = true;
                    console.log(`${profileName}: ${expiredPlans.length}개 만료된 계획을 이전 달로 이동`);
                }
            }
            
            // 새 달 월별 데이터 초기화
            const currentMonthData = getMonthlyData(profileData, currentMonth);
            if (!currentMonthData || Object.keys(currentMonthData).length === 0) {
                profileData.monthlyData[currentMonth] = {
                    exercisePlans: [],
                    score: 0,
                    completedCount: 0,
                    resetDate: now.toISOString()
                };
                hasChanges = true;
                console.log(`${profileName}: 새 달 데이터 초기화`);
            }
        }
        
        // 변경사항이 있으면 저장
        if (hasChanges) {
            await saveData(data);
            console.log('✅ 월별 데이터 정리 및 초기화 완료');
        }
        
        // 초기화 완료 표시
        localStorage.setItem('lastResetMonth', currentMonth);
        
        // 사용자에게 알림
        showMessage(`🎉 새로운 달이 시작되었습니다! (${currentMonth})\n🏆 랭킹이 초기화되었습니다.`, false);
        
        return true;
        
    } catch (error) {
        console.error('❌ 월별 초기화 중 오류:', error);
        return false;
    }
}

// 기존 checkMonthlyReset 함수 (하위 호환성)
function checkMonthlyReset() {
    return checkAndPerformMonthlyReset();
}

// 수동 월별 초기화 (개발/테스트용)
async function forceMonthlyReset() {
    console.log('🔧 수동 월별 초기화 실행...');
    
    // 강제로 초기화 실행
    localStorage.removeItem('lastResetMonth');
    
    const success = await checkAndPerformMonthlyReset();
    if (success) {
        console.log('✅ 수동 월별 초기화 완료');
        // UI 강제 업데이트
        await updateRanking();
        await updateProfileCards();
        if (currentProfile) {
            await updatePlansList();
        }
    } else {
        console.warn('⚠️ 수동 월별 초기화 실패');
    }
    
    return success;
}

// 개발자 도구용 - 전역 함수로 노출
if (typeof window !== 'undefined') {
    window.forceMonthlyReset = forceMonthlyReset;
    window.showCurrentMonthData = function() {
        const currentMonth = getCurrentMonthKey();
        console.log('현재 월:', currentMonth);
        
        loadData().then(data => {
            console.log('전체 데이터:', data);
            
            ['아빠', '엄마', '주환', '태환'].forEach(profile => {
                const profileData = data.profiles[profile];
                if (profileData) {
                    const score = calculateProfileScore(profile, profileData);
                    console.log(`${profile}: ${score}점`);
                    
                    const monthlyData = getMonthlyData(profileData, currentMonth);
                    console.log(`${profile} 월별 데이터:`, monthlyData);
                }
            });
        });
    };
}

// 기존 계획들을 월별 데이터로 마이그레이션
async function migrateExistingPlansToMonthly() {
    try {
        console.log('🔄 마이그레이션 시작: 기존 계획들을 월별 데이터로 변환');
        const data = await loadData();
        
        if (!data || !data.profiles) {
            console.log('📝 데이터가 없음 - 마이그레이션 건너뜀');
            return false;
        }
        
        let hasChanges = false;
        const profiles = ['아빠', '엄마', '주환', '태환'];
        
        for (const profileName of profiles) {
            const profileData = data.profiles[profileName];
            if (!profileData) {
                console.log(`⚠️ ${profileName} 프로필 데이터 없음`);
                continue;
            }
            
            if (!profileData.exercisePlans || !Array.isArray(profileData.exercisePlans)) {
                console.log(`⚠️ ${profileName} 운동 계획 데이터 없음`);
                continue;
            }
            
            // monthlyData가 없으면 초기화
            if (!profileData.monthlyData) {
                profileData.monthlyData = {};
                hasChanges = true;
            }
            
            // 각 계획을 해당 월별 데이터에 추가
            profileData.exercisePlans.forEach(plan => {
                // 계획 시작 날짜의 월 키 생성
                const planStartDate = new Date(plan.start_date);
                const planMonth = `${planStartDate.getFullYear()}-${String(planStartDate.getMonth() + 1).padStart(2, '0')}`;
                
                // 해당 월 데이터가 없으면 생성
                if (!profileData.monthlyData[planMonth]) {
                    profileData.monthlyData[planMonth] = {
                        exercisePlans: [],
                        score: 0,
                        completedCount: 0
                    };
                    hasChanges = true;
                }
                
                // 이미 해당 월에 이 계획이 있는지 확인
                const existingPlan = profileData.monthlyData[planMonth].exercisePlans.find(p => p.id === plan.id);
                if (!existingPlan) {
                    profileData.monthlyData[planMonth].exercisePlans.push(plan);
                    hasChanges = true;
                    console.log(`${profileName} - ${planMonth}월에 계획 추가:`, plan.exercise_type);
                }
            });
        }
        
        if (hasChanges) {
            await saveData(data);
            console.log('기존 계획들을 월별 데이터로 마이그레이션 완료');
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('마이그레이션 중 오류:', error);
        return false;
    }
}

// 운동 종류별 점수
function getExerciseScore(exerciseType) {
    const scores = {
        '러닝': 15,
        '달리기': 15,  // 기존 데이터 호환성
        '러닝머신': 15,
        '수영': 20,
        '자전거': 12,
        '기구운동': 18,
        '요가': 10,
        '걷기': 8,
        '야구': 15,
        '축구': 15,
        '기타': 5
    };
    return scores[exerciseType] || 5;
}

// 프로필 데이터 가져오기
async function getProfileData(profileName) {
    const data = await loadData();
    const profileData = data.profiles[profileName];
    const score = calculateProfileScore(profileName, profileData);
    
    let grade = '⛓️ 노예';
    if (score >= 400) grade = '✨ 신';
    else if (score >= 300) grade = '👑 왕';
    else if (score >= 200) grade = '🛡️ 백작';
    else if (score >= 120) grade = '🏇 기사';
    else if (score >= 50) grade = '🌾 농민';
    
    return { score, grade };
}

// 날짜 사이의 일수 계산
function calculateDaysBetween(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}



// Firebase에서 데이터 로드
async function loadDataFromFirebase() {
    if (!isFirebaseAvailable) return null;
    
    try {
        const doc = await db.collection('families').doc(FAMILY_CODE).get();
        if (doc.exists) {
            console.log("🔥 Firebase에서 데이터 로드 성공");
            return doc.data();
        }
        return null;
    } catch (error) {
        console.warn("⚠️ Firebase 데이터 로드 실패:", error);
        return null;
    }
}

// Firebase에 데이터 저장 (개선된 버전)
async function saveDataToFirebase(data) {
    if (!isFirebaseAvailable) return false;
    
    try {
        // 타임스탬프 추가로 동시 업데이트 감지
        const dataWithTimestamp = {
            ...data,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: navigator.userAgent.substring(0, 50) // 간단한 클라이언트 식별자
        };
        
        // 전체 문서 교체 (merge: false)로 데이터 일관성 보장
        await db.collection('families').doc(FAMILY_CODE).set(dataWithTimestamp);
        console.log("🔥 Firebase에 데이터 저장 성공");
        return true;
    } catch (error) {
        console.warn("⚠️ Firebase 데이터 저장 실패:", error);
        return false;
    }
}

// 데이터 로드 (Firebase 우선, 로컬 백업)
async function loadData() {
    // Firebase에서 먼저 시도
    if (isFirebaseAvailable) {
        const firebaseData = await loadDataFromFirebase();
        if (firebaseData) {
            return firebaseData;
        }
    }
    
    // Firebase 실패시 로컬에서 로드
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        return JSON.parse(saved);
    }
    
    // 아빠의 미리 등록된 운동 계획
    const dadExercisePlans = [
        {
            "id": 2,
            "exercise_type": "달리기",
            "exercise_content": "4km 가볍게 (6:30/km)",
            "start_date": "2025-07-18",
            "end_date": "2025-07-18",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 3,
            "exercise_type": "달리기",
            "exercise_content": "5km 가볍게 (6:20/km) + 하체 스트레칭",
            "start_date": "2025-07-19",
            "end_date": "2025-07-19",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 4,
            "exercise_type": "달리기",
            "exercise_content": "6km 조깅 (6:10/km)",
            "start_date": "2025-07-22",
            "end_date": "2025-07-22",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 5,
            "exercise_type": "달리기",
            "exercise_content": "2km 조깅 (6:10/km) + 4×400m 인터벌(5:00/km) + 2km 조깅 → 총 6.6km, 평균 5:50/km",
            "start_date": "2025-07-24",
            "end_date": "2025-07-24",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 6,
            "exercise_type": "달리기",
            "exercise_content": "5km 가볍게 (6:20/km)",
            "start_date": "2025-07-26",
            "end_date": "2025-07-26",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 7,
            "exercise_type": "달리기",
            "exercise_content": "7km 지구력주 (6:00/km)",
            "start_date": "2025-07-29",
            "end_date": "2025-07-29",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 8,
            "exercise_type": "달리기",
            "exercise_content": "5km 템포런 (5:30/km)",
            "start_date": "2025-07-31",
            "end_date": "2025-07-31",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 9,
            "exercise_type": "달리기",
            "exercise_content": "5km 가볍게 (6:30/km) + 보강운동",
            "start_date": "2025-08-02",
            "end_date": "2025-08-02",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 10,
            "exercise_type": "달리기",
            "exercise_content": "8km 지구력주 (6:00/km)",
            "start_date": "2025-08-05",
            "end_date": "2025-08-05",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 11,
            "exercise_type": "달리기",
            "exercise_content": "2km 조깅 + 5×400m 인터벌(4:50/km) + 2km 조깅 → 총 7km, 평균 5:40/km",
            "start_date": "2025-08-07",
            "end_date": "2025-08-07",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 12,
            "exercise_type": "달리기",
            "exercise_content": "5km 가볍게 (6:20/km)",
            "start_date": "2025-08-09",
            "end_date": "2025-08-09",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 13,
            "exercise_type": "달리기",
            "exercise_content": "9km 지구력주 (6:00/km)",
            "start_date": "2025-08-12",
            "end_date": "2025-08-12",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 14,
            "exercise_type": "달리기",
            "exercise_content": "6km 템포런 (5:20/km)",
            "start_date": "2025-08-14",
            "end_date": "2025-08-14",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 15,
            "exercise_type": "달리기",
            "exercise_content": "5km 가볍게 (6:30/km) + 코어운동",
            "start_date": "2025-08-16",
            "end_date": "2025-08-16",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 16,
            "exercise_type": "달리기",
            "exercise_content": "10km 롱런 (6:00/km)",
            "start_date": "2025-08-19",
            "end_date": "2025-08-19",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 17,
            "exercise_type": "달리기",
            "exercise_content": "2km 조깅 + 5×500m 인터벌(4:40/km) + 2km 조깅 → 총 7.5km, 평균 5:30/km",
            "start_date": "2025-08-21",
            "end_date": "2025-08-21",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 18,
            "exercise_type": "달리기",
            "exercise_content": "5km 가볍게 (6:20/km)",
            "start_date": "2025-08-23",
            "end_date": "2025-08-23",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 19,
            "exercise_type": "달리기",
            "exercise_content": "10km 롱런 (5:50/km)",
            "start_date": "2025-08-26",
            "end_date": "2025-08-26",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 20,
            "exercise_type": "달리기",
            "exercise_content": "6km 템포런 (5:10/km)",
            "start_date": "2025-08-28",
            "end_date": "2025-08-28",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 21,
            "exercise_type": "달리기",
            "exercise_content": "5km 가볍게 (6:30/km)",
            "start_date": "2025-08-30",
            "end_date": "2025-08-30",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 22,
            "exercise_type": "달리기",
            "exercise_content": "10km 시뮬레이션 (5:20~5:30/km)",
            "start_date": "2025-09-02",
            "end_date": "2025-09-02",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 23,
            "exercise_type": "달리기",
            "exercise_content": "2km 조깅 + 6×500m 인터벌(4:40/km) + 2km 조깅 → 총 8km, 평균 5:20/km",
            "start_date": "2025-09-04",
            "end_date": "2025-09-04",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 24,
            "exercise_type": "달리기",
            "exercise_content": "5km 가볍게 (6:30/km)",
            "start_date": "2025-09-06",
            "end_date": "2025-09-06",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 25,
            "exercise_type": "달리기",
            "exercise_content": "10km 시뮬레이션 (5:10~5:20/km)",
            "start_date": "2025-09-09",
            "end_date": "2025-09-09",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 26,
            "exercise_type": "달리기",
            "exercise_content": "6km 템포런 (5:00/km)",
            "start_date": "2025-09-11",
            "end_date": "2025-09-11",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 27,
            "exercise_type": "달리기",
            "exercise_content": "4km 가볍게 (6:30/km) + 컨디션 조절",
            "start_date": "2025-09-13",
            "end_date": "2025-09-13",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        },
        {
            "id": 28,
            "exercise_type": "달리기",
            "exercise_content": "10km 대회! 목표: 50분 (5:00/km)",
            "start_date": "2025-09-20",
            "end_date": "2025-09-20",
            "completed_dates": [],
            "created_date": "2025-07-17 17:48"
        }
    ];
    
    return {
        defaultProfile: null,
        profiles: {
            '아빠': {
                exercisePlans: dadExercisePlans,
                score: 0,
                completedCount: 0
            },
            '엄마': {
                exercisePlans: [],
                score: 0,
                completedCount: 0
            },
            '주환': {
                exercisePlans: [],
                score: 0,
                completedCount: 0
            },
            '태환': {
                exercisePlans: [],
                score: 0,
                completedCount: 0
            }
        }
    };
}

// 안전한 데이터 병합 (충돌 해결)
async function mergeDataSafely(firebaseData) {
    try {
        console.log('🔄 데이터 병합 시작...');
        
        // 로컬 데이터 가져오기
        const localDataStr = localStorage.getItem(STORAGE_KEY);
        const localData = localDataStr ? JSON.parse(localDataStr) : null;
        
        // Firebase 데이터가 없으면 로컬 데이터 반환
        if (!firebaseData) {
            console.log('Firebase 데이터가 없음 - 로컬 데이터 사용');
            return localData || getDefaultData();
        }
        
        // 로컬 데이터가 없으면 Firebase 데이터 반환
        if (!localData) {
            console.log('로컬 데이터가 없음 - Firebase 데이터 사용');
            return firebaseData;
        }
        
        console.log('로컬과 Firebase 데이터 병합 중...');
        
        // 프로필별로 병합
        const mergedProfiles = {};
        const allProfiles = ['아빠', '엄마', '주환', '태환'];
        
        for (const profileName of allProfiles) {
            const localProfile = localData.profiles?.[profileName] || { exercisePlans: [], monthlyData: {} };
            const firebaseProfile = firebaseData.profiles?.[profileName] || { exercisePlans: [], monthlyData: {} };
            
            // 운동 계획 병합 (ID 기준으로 중복 제거)
            const allPlans = [...(localProfile.exercisePlans || []), ...(firebaseProfile.exercisePlans || [])];
            const uniquePlans = [];
            const seenIds = new Set();
            
            // 최신 계획 우선 (높은 ID)
            allPlans.sort((a, b) => (b.id || 0) - (a.id || 0));
            
            for (const plan of allPlans) {
                if (!seenIds.has(plan.id)) {
                    seenIds.add(plan.id);
                    uniquePlans.push(plan);
                }
            }
            
            // 월별 데이터 병합
            const mergedMonthlyData = { ...localProfile.monthlyData };
            if (firebaseProfile.monthlyData) {
                for (const [month, monthData] of Object.entries(firebaseProfile.monthlyData)) {
                    if (!mergedMonthlyData[month]) {
                        mergedMonthlyData[month] = monthData;
                    } else {
                        // 월별 계획도 병합
                        const monthPlans = [...(mergedMonthlyData[month].exercisePlans || []), ...(monthData.exercisePlans || [])];
                        const uniqueMonthPlans = [];
                        const monthSeenIds = new Set();
                        
                        monthPlans.sort((a, b) => (b.id || 0) - (a.id || 0));
                        for (const plan of monthPlans) {
                            if (!monthSeenIds.has(plan.id)) {
                                monthSeenIds.add(plan.id);
                                uniqueMonthPlans.push(plan);
                            }
                        }
                        
                        mergedMonthlyData[month] = {
                            ...monthData,
                            exercisePlans: uniqueMonthPlans
                        };
                    }
                }
            }
            
            mergedProfiles[profileName] = {
                exercisePlans: uniquePlans,
                monthlyData: mergedMonthlyData,
                score: 0, // 점수는 다시 계산됨
                completedCount: 0 // 완료 수도 다시 계산됨
            };
        }
        
        const mergedData = {
            defaultProfile: firebaseData.defaultProfile || localData.defaultProfile,
            profiles: mergedProfiles
        };
        
        console.log('✅ 데이터 병합 완료');
        return mergedData;
        
    } catch (error) {
        console.error('❌ 데이터 병합 중 오류:', error);
        return firebaseData || localData || getDefaultData();
    }
}

// 기본 데이터 구조 반환
function getDefaultData() {
    return {
        defaultProfile: null,
        profiles: {
            '아빠': { exercisePlans: [], monthlyData: {}, score: 0, completedCount: 0 },
            '엄마': { exercisePlans: [], monthlyData: {}, score: 0, completedCount: 0 },
            '주환': { exercisePlans: [], monthlyData: {}, score: 0, completedCount: 0 },
            '태환': { exercisePlans: [], monthlyData: {}, score: 0, completedCount: 0 }
        }
    };
}

// 데이터 저장 (Firebase + 로컬 백업)
async function saveData(data) {
    try {
        // Firebase 업데이트 중임을 표시 (무한 루프 방지)
        isUpdatingFromFirebase = true;
        
    // 로컬에 백업 저장
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    
    // Firebase에도 저장 시도
    if (isFirebaseAvailable) {
            const success = await saveDataToFirebase(data);
            if (!success) {
                console.warn('⚠️ Firebase 저장 실패 - 로컬 저장만 완료됨');
            }
        }
        
        // 짧은 지연 후 플래그 해제
        setTimeout(() => {
            isUpdatingFromFirebase = false;
        }, 1000);
        
    } catch (error) {
        console.error('❌ 데이터 저장 중 오류:', error);
        isUpdatingFromFirebase = false;
        throw error;
    }
}

// 메시지 표시
function showMessage(message, isSmall = false) {
    // 간단한 토스트 메시지 구현
    const toast = document.createElement('div');
    
    if (isSmall) {
        // 작은 메시지 스타일 (투명 배경)
        toast.style.cssText = `
            position: fixed;
            top: 15px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.3);
            color: white;
            padding: 8px 15px;
            border-radius: 20px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.2);
            z-index: 10000;
            font-size: 0.85rem;
            font-weight: 500;
            animation: slideIn 0.3s ease-out;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.3);
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
        `;
    } else {
        // 일반 메시지 스타일
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #4facfe;
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            z-index: 10000;
            font-weight: bold;
            animation: slideIn 0.3s ease-out;
        `;
    }
    
    toast.textContent = message;
    
    // 애니메이션 CSS 추가
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
            to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(toast);
    
    // 작은 메시지는 더 짧게 표시
    const displayTime = isSmall ? 1500 : 3000;
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, displayTime);
}

// 앱 정보 표시
function showAppInfo() {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 15px; padding: 20px; max-width: 500px; width: 95%; max-height: 90vh; overflow-y: auto; text-align: center;">
            <h2 style="color: #4a5568; margin-bottom: 20px;">🔥 우리가족 운동관리 앱 🔥</h2>
            <p style="margin-bottom: 15px; line-height: 1.6;">🏃‍♂️ 가족의 운동을 관리할 수 있어요 </p>
            <p style="margin-bottom: 15px; line-height: 1.6;">📊 운동을 통해 점수를 획득하고 랭킹을 확인하세요</p>
            
            <h3 style="color: #4a5568; margin: 20px 0 10px;">💡 어떻게 사용해요? </h3>
            <div style="text-align: left; background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <div style="margin-bottom: 8px;"><strong>1.</strong> 프로필을 선택하세요</div>
                <div style="margin-bottom: 8px;"><strong>2.</strong> 운동 계획을 추가하세요</div>
                <div style="margin-bottom: 8px;"><strong>3.</strong> <strong>💪 오늘 완료하기</strong> 버튼으로 운동 완료!</div>
                <div><strong>4.</strong> 점수를 획득하고 가족 랭킹을 확인하세요</div>
            </div>
            
            <h3 style="color: #2196f3; margin: 20px 0 10px;">🏆 점수는 어떻게 되요? </h3>
            <div style="text-align: left; background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <div style="margin-bottom: 12px;"><strong>🎯 운동 완료 점수:</strong></div>
                <div style="margin-left: 16px; margin-bottom: 8px;">🏃 러닝 15점 | 🏃‍♀️ 러닝머신 15점</div>
                <div style="margin-left: 16px; margin-bottom: 8px;">🏊 수영 20점 | 🏋️ 기구운동 18점</div>
                <div style="margin-left: 16px; margin-bottom: 8px;">🚴 자전거 12점 | 🧘 요가 10점</div>
                <div style="margin-left: 16px; margin-bottom: 8px;">⚾ 야구 15점 | ⚽ 축구 15점</div>
                <div style="margin-left: 16px; margin-bottom: 12px;">🚶 걷기 8점 | 🏃‍♂️ 기타 5점</div>
                <div style="margin-bottom: 8px;"><strong>✅ 계획만 등록해도 </strong> 1점을 받아요 </div>
                <div><strong>📊 총점:</strong> 운동 완료 점수 + 계획 보너스 점수</div>
            </div>
            
            <h3 style="color: #ff9800; margin: 20px 0 10px;">🏰 계급은 어떻게 되요?</h3>
            <div style="text-align: left; background: #fff3e0; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <div style="margin-bottom: 8px;"><strong>✨ 신 </strong> 400점 이상</div>
                <div style="margin-bottom: 8px;"><strong>👑 왕 </strong> 300-399점</div>
                <div style="margin-bottom: 8px;"><strong>🛡️ 백작 </strong> 200-299점</div>
                <div style="margin-bottom: 8px;"><strong>🏇 기사 </strong> 120-199점</div>
                <div style="margin-bottom: 8px;"><strong>🌾 농민 </strong> 50-119점</div>
                <div><strong>⛓️ 노예 </strong> 0-49점 ㅜㅜㅜ</div>
            </div>
            
            <h3 style="color: #4caf50; margin: 20px 0 10px;">🔥 이런것도 되요! </h3>
            <div style="text-align: left; background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <div style="margin-bottom: 8px;">✅ <strong>실시간 동기화 </strong> 운동 완료시 즉시 공유</div>
                <div style="margin-bottom: 8px;">✅ <strong>클라우드 백업 </strong> 데이터 분실 걱정 없음</div>
                <div>✅ <strong>오프라인 지원 </strong> 인터넷 없어도 기록 가능</div>
            </div>
            
            <p style="color: #666; font-style: italic; margin-bottom: 20px;">Made with ❤️ for Family Fitness<br/>

            <button onclick="this.closest('div').parentElement.remove()" 
                    style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); 
                           color: white; border: none; border-radius: 8px; 
                           padding: 12px 24px; cursor: pointer; font-size: 1rem;">
                확인
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
}
