// Define Angular app
angular
    .module("profileApp", [])

    // Theme Service
    .service("themeService", function () {
        this.setTheme = function (theme) {
            if (theme === "system") {
                localStorage.removeItem("theme");
                if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
                    document.documentElement.classList.add("dark");
                } else {
                    document.documentElement.classList.remove("dark");
                }
            } else {
                localStorage.theme = theme;
                if (theme === "dark") {
                    document.documentElement.classList.add("dark");
                } else {
                    document.documentElement.classList.remove("dark");
                }
            }
        };

        this.initTheme = function () {
            if (
                localStorage.theme === "dark" ||
                (!("theme" in localStorage) &&
                    window.matchMedia("(prefers-color-scheme: dark)").matches)
            ) {
                document.documentElement.classList.add("dark");
            } else {
                document.documentElement.classList.remove("dark");
            }

            // Listen for OS theme changes
            window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
                if (!localStorage.theme) {
                    this.setTheme("system");
                }
            });
        };
    })
    // Main Controller
    .controller("MainController", [
        "$scope",
        "$http",
        "themeService",
        function ($scope, $http, themeService) {
            // Get user from URL
            var urlParams = new URLSearchParams(window.location.search);
            $scope.user = urlParams.get("user");
            $scope.userFullName = null;
            $scope.userData = [];
            $scope.error = null;
            $scope.isLoading = false;
            $scope.translations = {};
            $scope.currentLang =
                localStorage.getItem("langId") || navigator.language.substring(0, 2);

            $scope.isDark = localStorage.getItem("theme") === "dark";
            $scope.toggleTheme = function () {
                $scope.isDark = !$scope.isDark;

                if ($scope.isDark) {
                    document.documentElement.classList.add("dark");
                    localStorage.setItem("theme", "dark");
                } else {
                    document.documentElement.classList.remove("dark");
                    localStorage.setItem("theme", "light");
                }
            };

            // Data loading and processing
            $scope.loadData = function () {
                $scope.isLoading = true;
                $scope.error = null;
                $scope.userData = [];

                $http
                    .get("./assets/database/data.json")
                    .then(function (response) {
                        if (!$scope.user) {
                            $scope.error = "Vui lòng cung cấp tham số user";
                            return;
                        }

                        let userData = response.data.find(
                            (element) => element.user === $scope.user
                        );
                        if (!userData) {
                            $scope.error = `Không tìm thấy thông tin cho user: ${$scope.user}`;
                            return;
                        }

                        $scope.userData = userData.data
                            .map((item, index) => {
                                try {
                                    // Hàm decode Base64 cải tiến để xử lý Unicode
                                    const decodeBase64 = (str) => {
                                        try {
                                            // Decode base64 to bytes
                                            const binary = atob(str);
                                            // Convert bytes to Unicode characters
                                            const bytes = new Uint8Array(binary.length);
                                            for (let i = 0; i < binary.length; i++) {
                                                bytes[i] = binary.charCodeAt(i);
                                            }
                                            // Decode bytes as UTF-8 text
                                            return new TextDecoder("utf-8").decode(bytes);
                                        } catch (e) {
                                            console.error("Decode error:", e);
                                            return str;
                                        }
                                    };

                                    const decodedUrl = decodeBase64(item.url);
                                    const decodedValue = decodeBase64(item.value);
                                    let nativeUrl = decodedUrl;

                                    if (item.key === "name") {
                                        $scope.userFullName = decodedValue;
                                        document.title = "Profile | " + $scope.userFullName;
                                    }

                                    return {
                                        ...item,
                                        decodedUrl: nativeUrl,
                                        webUrl: decodedUrl, // Giữ lại URL web để fallback
                                        decodedValue: decodedValue,
                                        iconPath: `./assets/img/${item.icon}.png`,
                                        delay: index * 100,
                                    };
                                } catch (error) {
                                    console.error(`Error processing data for ${item.key}:`, error);
                                    return null;
                                }
                            })
                            .filter((item) => item !== null);
                    })
                    .catch(function (error) {
                        $scope.error = `Lỗi khi tải dữ liệu: ${error.message}`;
                    })
                    .finally(function () {
                        $scope.isLoading = false;
                    });
            };

            // Change language handler
            $scope.changeLanguage = function (langCode) {
                $scope.currentLang = langCode;
                localStorage.setItem("langId", langCode);

                $http
                    .get(`./assets/lang/${langCode}.json`)
                    .then(function (response) {
                        $scope.translations = response.data;
                    })
                    .catch(function (error) {
                        console.error(`Error loading language file ${langCode}:`, error);
                        if (langCode !== "en") {
                            console.log("Falling back to English");
                            $scope.changeLanguage("en");
                        }
                    });
            };

            // Initialize theme
            $scope.theme = localStorage.theme || "system";
            themeService.initTheme();

            // Theme handler
            $scope.changeTheme = function (theme) {
                $scope.theme = theme;
                themeService.setTheme(theme);
            };

            // Handle deep linking (đã chỉnh theo UL-first)
            $scope.handleDeepLink = function (event, item) {
                event.preventDefault();

                const isAndroid = /Android/i.test(navigator.userAgent);
                const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

                // decode base64 an toàn
                let decodedUrl = "";
                try {
                    decodedUrl = atob(item?.url || "");
                } catch {
                    decodedUrl = item?.url || "";
                }
                if (!decodedUrl) return;

                let appUrl = "";
                let webUrl = decodedUrl;

                // Helper để set đủ fallback
                const setBoth = (app, web) => {
                    if (app) appUrl = app;
                    webUrl = web || webUrl || decodedUrl;
                };

                // Determine appropriate URL based on platform and app
                switch ((item.key || "").toLowerCase()) {
                    case "facebook": {
                        // Chuẩn hoá và CHỈ dùng Universal Link
                        // 1) share
                        const share = decodedUrl.match(/facebook\.com\/share\/([^/?#]+)/i);
                        // 2) numeric id
                        const idParam = decodedUrl.match(/facebook\.com\/profile\.php\?id=(\d+)/i);
                        // 3) vanity
                        const vanity = decodedUrl.match(/facebook\.com\/([A-Za-z0-9.\-]+)/i);

                        // Hàm bỏ query tracking (mibextid, fbclid, …)
                        const stripQuery = (url) => url.replace(/([?#]).*$/, "");

                        if (share) {
                            // VD: https://www.facebook.com/share/193GSeoxx8/
                            webUrl = stripQuery(`https://www.facebook.com/share/${share[1]}/`);
                            appUrl = ""; // TUYỆT ĐỐI không set fb://... ở đây
                        } else if (idParam) {
                            // VD: https://www.facebook.com/profile.php?id=123456
                            webUrl = stripQuery(
                                `https://www.facebook.com/profile.php?id=${idParam[1]}`
                            );
                            appUrl = ""; // không dùng fb://profile để tránh lần đầu rơi về home
                        } else if (vanity) {
                            // VD: https://www.facebook.com/vanity.name
                            webUrl = stripQuery(`https://www.facebook.com/${vanity[1]}`);
                            appUrl = ""; // không scheme
                        } else {
                            // fallback giữ nguyên nhưng bỏ query rác
                            webUrl = stripQuery(decodedUrl);
                            appUrl = "";
                        }
                        break;
                    }

                    case "zalo":
                        // Format: zalo://chat/[phone_number]
                        const phone = decodedUrl.match(/zalo\.me\/([^\/\?]+)/);
                        if (phone) {
                            nativeUrl = `zalo://chat/${phone[1]}`;
                        }
                        break;

                    case "tiktok":
                        // Format: snssdk1233://user/profile/[username]
                        const username = decodedUrl.match(/tiktok\.com\/@([^\/\?]+)/);
                        if (username) {
                            nativeUrl = `snssdk1233://user/profile/${username[1]}`;
                        }
                        break;

                    case "zalo": {
                        // Ép https; để UL tự bắt
                        const m = decodedUrl.match(/zalo\.me\/(\+?\d{8,15})/i);
                        if (m) {
                            setBoth("", `https://zalo.me/${m[1]}`);
                        }
                        break;
                    }

                    case "tiktok": {
                        const m = decodedUrl.match(/tiktok\.com\/@([A-Za-z0-9._]+)/i);
                        if (m) {
                            setBoth("", `https://www.tiktok.com/@${m[1]}`);
                        }
                        break;
                    }

                    case "phone": {
                        if (decodedUrl.startsWith("tel:")) {
                            setBoth(decodedUrl, decodedUrl);
                        } else if (/^\+?\d{6,15}$/.test(decodedUrl)) {
                            setBoth(`tel:${decodedUrl}`, `tel:${decodedUrl}`);
                        }
                        break;
                    }

                    case "email": {
                        if (decodedUrl.startsWith("mailto:")) {
                            setBoth(decodedUrl, decodedUrl);
                        } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(decodedUrl)) {
                            setBoth(`mailto:${decodedUrl}`, `mailto:${decodedUrl}`);
                        }
                        break;
                    }

                    case "location": {
                        let q = "";
                        try {
                            const u = new URL(decodedUrl);
                            if (/(^|\.)google\.[^/]+$/i.test(u.hostname)) {
                                q = u.searchParams.get("q") || "";
                            }
                        } catch {
                            /* not a full URL */
                        }

                        if (!q) {
                            const place = decodedUrl.match(/maps\/place\/([^/?#]+)/i);
                            if (place) q = decodeURIComponent(place[1]);
                        }

                        if (q) {
                            if (isAndroid) {
                                // Android: mở thẳng app Google Maps
                                appUrl = `geo:0,0?q=${encodeURIComponent(q)}`;
                                webUrl = ""; // KHÔNG fallback web
                            } else if (isIOS) {
                                // iOS: mở app Apple Maps
                                appUrl = `maps://?q=${encodeURIComponent(q)}`;
                                webUrl = ""; // KHÔNG fallback web
                            }
                        } else {
                            // Nếu không tách được query thì chỉ giữ web cho desktop
                            webUrl = decodedUrl;
                            appUrl = "";
                        }
                        break;
                    }

                    case "github": {
                        const m = decodedUrl.match(/github\.com\/([^\/\?\s#]+)/i);
                        if (m) {
                            // GitHub app đôi khi không deep route → ưu tiên UL
                            setBoth("", `https://github.com/${m[1]}`);
                        }
                        break;
                    }

                    case "youtube": {
                        // Chuẩn hoá YouTube → dùng Universal Link
                        // Hỗ trợ các dạng: youtu.be/<id>, /watch?v=, /shorts/<id>, /playlist?list=, /channel/<id>, /@handle
                        const stripQuery = (url) => url.replace(/([?#]).*$/, "");

                        let id = "";
                        let list = "";

                        // youtu.be/<id>
                        const be = decodedUrl.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/i);
                        // /watch?v=<id>
                        const wv = decodedUrl.match(/[?&]v=([A-Za-z0-9_-]{6,})/i);
                        // /shorts/<id>
                        const sh = decodedUrl.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/i);
                        // playlist
                        const pl = decodedUrl.match(/[?&]list=([A-Za-z0-9_-]+)/i);
                        // channel
                        const ch = decodedUrl.match(/youtube\.com\/channel\/([A-Za-z0-9_-]+)/i);
                        // handle @...
                        const hd = decodedUrl.match(/youtube\.com\/(@[A-Za-z0-9._-]+)/i);

                        if (be) {
                            id = be[1];
                            webUrl = `https://www.youtube.com/watch?v=${id}`;
                        } else if (wv) {
                            id = wv[1];
                            webUrl = `https://www.youtube.com/watch?v=${id}`;
                        } else if (sh) {
                            id = sh[1];
                            webUrl = `https://www.youtube.com/shorts/${id}`;
                        } else if (pl) {
                            list = pl[1];
                            webUrl = `https://www.youtube.com/playlist?list=${list}`;
                        } else if (ch) {
                            webUrl = `https://www.youtube.com/channel/${ch[1]}`;
                        } else if (hd) {
                            webUrl = `https://www.youtube.com/${hd[1]}`;
                        } else {
                            webUrl = stripQuery(decodedUrl.replace(/^http:\/\//, "https://"));
                        }

                        // UL-first: để app YouTube tự hook; nếu mày MUỐN ép mở app:
                        // if (isAndroid && id) appUrl = `intent://www.youtube.com/watch?v=${id}#Intent;package=com.google.android.youtube;scheme=https;end`;
                        // if (isIOS && id) appUrl = `vnd.youtube://${id}`;

                        break;
                    }

                    case "linkedin": {
                        // Chuẩn hoá LinkedIn → dùng Universal Link
                        // Hỗ trợ: /in/<username>, /company/<slug>, /feed/update/urn:li:activity:<id>, /posts/...
                        const stripQuery = (url) => url.replace(/([?#]).*$/, "");

                        const inUser = decodedUrl.match(/linkedin\.com\/in\/([A-Za-z0-9-_%]+)/i);
                        const company = decodedUrl.match(
                            /linkedin\.com\/company\/([A-Za-z0-9-_%]+)/i
                        );
                        const activity = decodedUrl.match(
                            /linkedin\.com\/feed\/update\/(urn:li:activity:\d+)/i
                        );
                        const posts = decodedUrl.match(/linkedin\.com\/posts\/([A-Za-z0-9-_%]+)/i);
                        const profileId = decodedUrl.match(
                            /linkedin\.com\/profile\/view\?id=([A-Za-z0-9-_%]+)/i
                        );

                        if (inUser) {
                            webUrl = `https://www.linkedin.com/in/${inUser[1]}`;
                        } else if (company) {
                            webUrl = `https://www.linkedin.com/company/${company[1]}`;
                        } else if (activity) {
                            webUrl = `https://www.linkedin.com/feed/update/${activity[1]}`;
                        } else if (posts) {
                            webUrl = `https://www.linkedin.com/posts/${posts[1]}`;
                        } else if (profileId) {
                            webUrl = `https://www.linkedin.com/profile/view?id=${profileId[1]}`;
                        } else {
                            webUrl = stripQuery(decodedUrl.replace(/^http:\/\//, "https://"));
                        }

                        // Không dùng scheme linkedin:// để tránh rơi về home. UL sẽ tự mở app nếu hỗ trợ.
                        appUrl = "";
                        break;
                    }
                }

                // Check if device is mobile
                const isMobile = isAndroid || isIOS;

                if (isMobile) {
                    if (appUrl) {
                        // Mobile: ưu tiên appUrl, KHÔNG mở web fallback
                        window.location.href = appUrl;
                    } else {
                        // Nếu không có appUrl (vd dữ liệu location lỗi) thì mở web
                        window.location.href = webUrl;
                    }
                } else {
                    // Desktop mở tab mới
                    window.open(webUrl, "_blank", "noopener,noreferrer");
                }
            };

            // Initialize data and language
            $scope.loadData();
            $scope.changeLanguage($scope.currentLang);
        },
    ]);
