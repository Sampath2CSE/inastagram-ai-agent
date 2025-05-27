// Instagram AI Agent - Fixed for Verification & Modern Instagram
import { Actor } from 'apify';
import { PuppeteerCrawler } from 'crawlee';

// Helper function for delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

await Actor.main(async () => {
    console.log('🤖 Starting Instagram AI Agent...');
    
    // Get input configuration
    const input = await Actor.getInput() ?? {};
    const {
        username,
        password,
        openaiApiKey = null,
        targetHashtags = ['automation', 'ai'],
        targetAudience = 'General audience',
        engagementRate = 15,
        commentRate = 30,
        followRate = 5,
        brandTone = 'friendly',
        autoPost = false,
        contentThemes = [],
        maxLikesPerHour = 30,
        maxCommentsPerHour = 10,
        maxFollowsPerHour = 20,
        delayBetweenActions = 30,
        useProxies = true,
        sessionTimeout = 30
    } = input;

    // Validate required inputs
    if (!username || !password) {
        throw new Error('Instagram username and password are required');
    }
    if (!targetHashtags || targetHashtags.length === 0) {
        throw new Error('At least one target hashtag is required');
    }

    console.log(`📊 Configuration loaded:`);
    console.log(`- Username: ${username}`);
    console.log(`- Target hashtags: ${targetHashtags.join(', ')}`);
    console.log(`- Engagement rate: ${engagementRate}%`);
    console.log(`- Max likes per hour: ${maxLikesPerHour}`);
    console.log(`- Use proxies: ${useProxies}`);

    // Initialize results
    const results = {
        totalLikes: 0,
        totalComments: 0,
        totalFollows: 0,
        processedPosts: 0,
        processedHashtags: 0,
        skippedHashtags: 0,
        errors: [],
        proxyUsed: useProxies,
        loginStatus: 'unknown',
        timestamp: new Date().toISOString(),
        success: true
    };

    // Configure proxy if enabled
    let proxyConfiguration = null;
    if (useProxies) {
        try {
            proxyConfiguration = await Actor.createProxyConfiguration({
                groups: ['RESIDENTIAL'],
                countryCode: 'US'
            });
            console.log('🌐 Proxy configuration created successfully');
        } catch (error) {
            console.log('⚠️ Proxy setup failed:', error.message);
            console.log('⚠️ Continuing without proxies');
            useProxies = false;
            results.proxyUsed = false;
        }
    }

    // Create crawler with extended timeout
    const crawlerOptions = {
        launchContext: {
            launchOptions: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-blink-features=AutomationControlled'
                ]
            }
        },
        maxRequestsPerCrawl: 1,
        requestHandlerTimeoutSecs: 180, // Increase timeout to 3 minutes
        proxyConfiguration: proxyConfiguration,
        sessionPoolOptions: {
            maxPoolSize: 1,
            sessionOptions: {
                maxUsageCount: 1
            }
        }
    };

    const crawler = new PuppeteerCrawler({
        ...crawlerOptions,
        async requestHandler({ page, proxyInfo }) {
            try {
                // Log proxy information
                if (proxyInfo) {
                    console.log(`🌐 Using proxy: ${proxyInfo.hostname}:${proxyInfo.port} (${proxyInfo.countryCode || 'Unknown'})`);
                    results.actualProxyUsed = `${proxyInfo.hostname}:${proxyInfo.port}`;
                } else {
                    console.log('🌐 No proxy in use (direct connection)');
                }

                // Set realistic user agent and viewport
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
                await page.setViewport({ width: 1366, height: 768 });

                // Remove webdriver property
                await page.evaluateOnNewDocument(() => {
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined,
                    });
                });

                // Login to Instagram
                console.log('🔐 Logging into Instagram...');
                await page.goto('https://www.instagram.com/accounts/login/', { 
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });

                // Wait for login form
                await page.waitForSelector('input[name="username"]', { timeout: 15000 });
                await delay(2000);
                
                // Enter credentials with more human-like behavior
                await page.focus('input[name="username"]');
                await page.keyboard.type(username, { delay: 150 });
                await delay(1000);
                
                await page.focus('input[name="password"]');
                await page.keyboard.type(password, { delay: 150 });
                await delay(2000);
                
                // Click login button
                await page.click('button[type="submit"]');
                console.log('🔄 Login submitted, waiting for response...');
                
                // Wait longer for login response
                await delay(5000);
                
                // Check current URL and handle different scenarios
                const currentUrl = page.url();
                console.log(`Current URL after login: ${currentUrl}`);
                
                if (currentUrl.includes('/challenge/') || currentUrl.includes('/auth_platform/')) {
                    results.loginStatus = 'verification_required';
                    console.log('🔒 Instagram requires additional verification (2FA/phone/email)');
                    console.log('⚠️ This account needs manual verification. Try:');
                    console.log('   1. Disable 2FA temporarily');
                    console.log('   2. Use a different account');
                    console.log('   3. Verify account manually first');
                    
                    results.errors.push('Account requires verification - 2FA or security check needed');
                    await Actor.pushData(results);
                    return; // Exit gracefully instead of throwing error
                }
                
                if (currentUrl.includes('/accounts/login/')) {
                    results.loginStatus = 'failed';
                    // Check for error messages
                    try {
                        const errorElement = await page.$('div[role="alert"], .error-message, #slfErrorAlert');
                        if (errorElement) {
                            const errorText = await page.evaluate(el => el.textContent, errorElement);
                            console.log(`❌ Login error: ${errorText}`);
                            results.errors.push(`Login failed: ${errorText}`);
                        } else {
                            results.errors.push('Login failed: Invalid credentials or account locked');
                        }
                    } catch (e) {
                        results.errors.push('Login failed: Unknown error');
                    }
                    await Actor.pushData(results);
                    return;
                }

                results.loginStatus = 'success';
                console.log('✅ Successfully logged into Instagram');

                // Handle post-login popups
                await delay(3000);
                try {
                    // Handle multiple types of popups
                    const popupSelectors = [
                        "//button[contains(text(), 'Not Now')]",
                        "//button[contains(text(), 'Not now')]", 
                        "//button[contains(text(), 'Save Info')]",
                        "//button[contains(text(), 'Turn on')]"
                    ];
                    
                    for (const selector of popupSelectors) {
                        try {
                            const buttons = await page.$x(selector);
                            if (buttons.length > 0) {
                                await buttons[0].click();
                                console.log(`✅ Dismissed popup: ${selector}`);
                                await delay(2000);
                                break;
                            }
                        } catch (e) {
                            continue;
                        }
                    }
                } catch (e) {
                    console.log('No popups found');
                }

                // Try a different approach - go to explore page first
                console.log('🏠 Navigating to explore page...');
                await page.goto('https://www.instagram.com/explore/', {
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });
                await delay(3000);

                // Process hashtags
                for (const hashtag of targetHashtags.slice(0, 2)) {
                    try {
                        console.log(`\n🎯 Processing hashtag: #${hashtag}`);
                        
                        // Use search instead of direct hashtag navigation
                        console.log('🔍 Using Instagram search...');
                        
                        // Click search
                        try {
                            await page.click('a[href="/explore/"]', { timeout: 5000 });
                            await delay(2000);
                        } catch (e) {
                            console.log('Explore link not found, trying search icon...');
                        }
                        
                        // Try to find and use search input
                        const searchSelectors = [
                            'input[placeholder*="Search"]',
                            'input[aria-label*="Search"]',
                            'input[type="search"]',
                            'input.x1lugfcp' // Instagram search input class
                        ];
                        
                        let searchInput = null;
                        for (const selector of searchSelectors) {
                            try {
                                searchInput = await page.$(selector);
                                if (searchInput) {
                                    console.log(`✅ Found search input: ${selector}`);
                                    break;
                                }
                            } catch (e) {
                                continue;
                            }
                        }
                        
                        if (searchInput) {
                            // Use search to find hashtag
                            await searchInput.click();
                            await delay(1000);
                            await searchInput.type(`#${hashtag}`, { delay: 100 });
                            await delay(2000);
                            
                            // Try to click on hashtag result
                            try {
                                await page.click(`a[href*="/explore/tags/${hashtag}/"]`, { timeout: 5000 });
                                await delay(3000);
                            } catch (e) {
                                console.log('Hashtag link not found in search results');
                                results.skippedHashtags++;
                                continue;
                            }
                        } else {
                            // Fallback: direct navigation
                            console.log('🔄 Fallback: Direct hashtag navigation...');
                            await page.goto(`https://www.instagram.com/explore/tags/${hashtag}/`, {
                                waitUntil: 'networkidle2',
                                timeout: 30000
                            });
                            await delay(5000);
                        }

                        // Look for posts with updated selectors for 2025 Instagram
                        console.log('🔍 Looking for posts...');
                        let posts = [];
                        
                        // Modern Instagram selectors (updated for 2025)
                        const modernSelectors = [
                            'a[href*="/p/"][role="link"]',
                            'a[href*="/reel/"][role="link"]', 
                            'div[role="button"] a[href*="/p/"]',
                            'article a[href*="/p/"]',
                            'a[href*="/p/"]'
                        ];

                        for (const selector of modernSelectors) {
                            try {
                                console.log(`🔍 Trying modern selector: ${selector}`);
                                await page.waitForSelector(selector, { timeout: 8000 });
                                
                                posts = await page.$$eval(selector, links => 
                                    links
                                        .map(link => link.href)
                                        .filter(href => href && (href.includes('/p/') || href.includes('/reel/')))
                                        .slice(0, 6)
                                );
                                
                                if (posts.length > 0) {
                                    console.log(`✅ Found ${posts.length} posts using: ${selector}`);
                                    break;
                                }
                            } catch (selectorError) {
                                console.log(`❌ Selector failed: ${selector}`);
                                continue;
                            }
                        }

                        if (posts.length === 0) {
                            console.log(`⚠️ No posts found for hashtag #${hashtag}`);
                            results.skippedHashtags++;
                            continue;
                        }

                        results.processedHashtags++;
                        const postsToEngage = Math.min(2, posts.length);
                        console.log(`🎯 Will process ${postsToEngage} posts`);

                        // Process posts
                        for (let i = 0; i < postsToEngage; i++) {
                            const postUrl = posts[i];
                            
                            try {
                                console.log(`📝 Processing post ${i + 1}/${postsToEngage}`);
                                
                                await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                                await delay(3000);

                                // Try to like with modern selectors
                                let liked = false;
                                const likeSelectors = [
                                    'button[aria-label="Like"] svg',
                                    'span[aria-label="Like"]',
                                    'svg[aria-label="Like"]',
                                    'button svg[aria-label="Like"]'
                                ];

                                for (const likeSelector of likeSelectors) {
                                    try {
                                        const likeElement = await page.$(likeSelector);
                                        if (likeElement) {
                                            await likeElement.click();
                                            liked = true;
                                            results.totalLikes++;
                                            console.log(`❤️ Post liked! Total: ${results.totalLikes}`);
                                            
                                            try {
                                                await Actor.chargeEvent('engagement_action', 1);
                                            } catch (chargeError) {
                                                console.log('Note: Event charging not available in test mode');
                                            }
                                            break;
                                        }
                                    } catch (e) {
                                        continue;
                                    }
                                }

                                if (!liked) {
                                    console.log('❤️ Post already liked or like button not accessible');
                                }

                                results.processedPosts++;
                                await delay(delayBetweenActions * 1000 + Math.random() * 5000);

                            } catch (error) {
                                console.error('❌ Error processing post:', error.message);
                                results.errors.push(`Post error: ${error.message}`);
                            }
                        }

                        await delay(15000 + Math.random() * 10000);

                    } catch (error) {
                        console.error(`❌ Error processing hashtag #${hashtag}:`, error.message);
                        results.errors.push(`Hashtag ${hashtag}: ${error.message}`);
                        results.skippedHashtags++;
                    }
                }

                // Store final results
                await Actor.pushData(results);
                console.log('\n📊 Instagram AI Agent Results:');
                console.log(`- Login status: ${results.loginStatus}`);
                console.log(`- Processed hashtags: ${results.processedHashtags}`);
                console.log(`- Skipped hashtags: ${results.skippedHashtags}`);
                console.log(`- Processed posts: ${results.processedPosts}`);
                console.log(`- Total likes: ${results.totalLikes}`);
                console.log(`- Proxy used: ${results.proxyUsed ? 'Yes' : 'No'}`);
                console.log(`- Errors: ${results.errors.length}`);
                
                if (results.totalLikes > 0) {
                    console.log(`🎉 Campaign successful! Liked ${results.totalLikes} posts`);
                } else if (results.loginStatus === 'verification_required') {
                    console.log(`🔒 Account needs verification - use a different account or disable 2FA`);
                } else {
                    console.log(`⚠️ No engagement completed. Check account status and hashtag availability.`);
                }

            } catch (error) {
                console.error('❌ Fatal error:', error.message);
                results.success = false;
                results.errors.push(`Fatal: ${error.message}`);
                await Actor.pushData(results);
                // Don't throw - let it complete gracefully
            }
        }
    });

    await crawler.run(['https://www.instagram.com']);
    console.log('✅ Instagram AI Agent completed successfully!');
});