// Instagram AI Agent - Safe Version Without Proxies
import { Actor } from 'apify';
import { PuppeteerCrawler } from 'crawlee';

// Helper function for delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

await Actor.main(async () => {
    console.log('🤖 Starting Instagram AI Agent (Safe Mode)...');
    
    // Get input configuration
    const input = await Actor.getInput() ?? {};
    const {
        username,
        password,
        openaiApiKey = null,
        targetHashtags = ['automation', 'ai'],
        targetAudience = 'General audience',
        engagementRate = 10, // Lower default rate for safety
        commentRate = 0,     // Disable comments for safety
        followRate = 0,      // Disable follows for safety
        brandTone = 'friendly',
        autoPost = false,
        contentThemes = [],
        maxLikesPerHour = 15, // Much lower limit
        maxCommentsPerHour = 0,
        maxFollowsPerHour = 0,
        delayBetweenActions = 60, // Longer delays
        useProxies = false,   // Default to no proxies
        sessionTimeout = 30
    } = input;

    // Validate required inputs
    if (!username || !password) {
        throw new Error('Instagram username and password are required');
    }
    if (!targetHashtags || targetHashtags.length === 0) {
        throw new Error('At least one target hashtag is required');
    }

    console.log(`📊 Configuration loaded (Safe Mode):`);
    console.log(`- Username: ${username}`);
    console.log(`- Target hashtags: ${targetHashtags.join(', ')}`);
    console.log(`- Engagement rate: ${engagementRate}% (conservative)`);
    console.log(`- Max likes per hour: ${maxLikesPerHour} (limited)`);
    console.log(`- Use proxies: ${useProxies} (safer without)`);
    console.log(`- Delay between actions: ${delayBetweenActions}s (human-like)`);

    // Initialize results
    const results = {
        totalLikes: 0,
        totalComments: 0,
        totalFollows: 0,
        processedPosts: 0,
        processedHashtags: 0,
        skippedHashtags: 0,
        errors: [],
        proxyUsed: false, // Always false in safe mode
        loginStatus: 'unknown',
        safeMode: true,
        timestamp: new Date().toISOString(),
        success: true
    };

    // Rate limiting (very conservative)
    let likesThisHour = 0;
    let lastHourReset = Date.now();

    const resetCountersIfNeeded = () => {
        if (Date.now() - lastHourReset > 3600000) {
            likesThisHour = 0;
            lastHourReset = Date.now();
            console.log('🔄 Rate limit counters reset');
        }
    };

    // Create crawler WITHOUT proxy configuration
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
                    '--disable-features=VizDisplayCompositor'
                    // NO PROXY ARGS - using direct connection
                ]
            }
        },
        maxRequestsPerCrawl: 1,
        requestHandlerTimeoutSecs: 300, // 5 minutes for safety
        // NO proxyConfiguration - direct connection only
        sessionPoolOptions: {
            maxPoolSize: 1,
            sessionOptions: {
                maxUsageCount: 1
            }
        }
    };

    const crawler = new PuppeteerCrawler({
        ...crawlerOptions,
        async requestHandler({ page }) {
            try {
                console.log('🌐 Using direct connection (no proxy) for better account safety');

                // Set very realistic user agent
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
                await page.setViewport({ width: 1366, height: 768 });

                // Remove automation indicators
                await page.evaluateOnNewDocument(() => {
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined,
                    });
                    // Remove chrome automation flags
                    window.chrome = {
                        runtime: {}
                    };
                });

                // Navigate to Instagram with longer delay
                console.log('🔐 Logging into Instagram (safe mode)...');
                await page.goto('https://www.instagram.com/accounts/login/', { 
                    waitUntil: 'networkidle2',
                    timeout: 45000
                });

                // Wait longer for page to fully load
                await delay(5000);

                // Wait for login form
                await page.waitForSelector('input[name="username"]', { timeout: 20000 });
                await delay(2000);
                
                // Very human-like typing
                console.log('⌨️ Entering credentials with human-like timing...');
                await page.focus('input[name="username"]');
                await delay(1000);
                for (const char of username) {
                    await page.keyboard.type(char);
                    await delay(100 + Math.random() * 100); // Random typing speed
                }
                
                await delay(2000);
                await page.focus('input[name="password"]');
                await delay(1000);
                for (const char of password) {
                    await page.keyboard.type(char);
                    await delay(100 + Math.random() * 100);
                }
                
                // Wait before clicking login
                await delay(3000);
                
                // Click login button
                console.log('🔄 Submitting login...');
                await page.click('button[type="submit"]');
                
                // Wait longer for login response
                await delay(8000);
                
                // Check login result
                const currentUrl = page.url();
                console.log(`Current URL: ${currentUrl}`);
                
                if (currentUrl.includes('/challenge/') || currentUrl.includes('/auth_platform/')) {
                    results.loginStatus = 'verification_required';
                    console.log('🔒 Account requires verification - this is common after using proxies');
                    console.log('💡 Solution: Wait 24-48 hours and try again, or verify manually');
                    results.errors.push('Account flagged for verification - likely due to previous proxy use');
                    await Actor.pushData(results);
                    return;
                }
                
                if (currentUrl.includes('/accounts/login/')) {
                    results.loginStatus = 'failed';
                    console.log('❌ Login failed - check credentials');
                    results.errors.push('Login failed - invalid credentials or account locked');
                    await Actor.pushData(results);
                    return;
                }

                results.loginStatus = 'success';
                console.log('✅ Successfully logged into Instagram with direct connection');

                // Handle popups very carefully
                await delay(5000);
                try {
                    const notNowButtons = await page.$x("//button[contains(text(), 'Not Now') or contains(text(), 'Not now')]");
                    if (notNowButtons.length > 0) {
                        await notNowButtons[0].click();
                        console.log('✅ Dismissed popup');
                        await delay(3000);
                    }
                } catch (e) {
                    console.log('No popups to dismiss');
                }

                // Go to home feed first (more natural)
                console.log('🏠 Navigating to home feed first...');
                await page.goto('https://www.instagram.com/', {
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });
                await delay(5000);

                // Process hashtags with extreme caution
                for (const hashtag of targetHashtags.slice(0, 1)) { // Only 1 hashtag in safe mode
                    resetCountersIfNeeded();
                    
                    if (likesThisHour >= maxLikesPerHour) {
                        console.log('⚠️ Daily like limit reached for safety');
                        break;
                    }

                    try {
                        console.log(`\n🎯 Processing hashtag: #${hashtag} (safe mode)`);
                        
                        // Navigate very slowly to hashtag
                        console.log('🔄 Navigating to hashtag page...');
                        await page.goto(`https://www.instagram.com/explore/tags/${hashtag}/`, {
                            waitUntil: 'networkidle2',
                            timeout: 45000
                        });
                        
                        // Wait much longer for content to load
                        await delay(8000);

                        // Look for posts with very patient approach
                        console.log('🔍 Looking for posts (patient approach)...');
                        let posts = [];
                        
                        const safeSelectors = [
                            'a[href*="/p/"]',
                            'article a[href*="/p/"]'
                        ];

                        for (const selector of safeSelectors) {
                            try {
                                console.log(`🔍 Trying selector: ${selector}`);
                                await page.waitForSelector(selector, { timeout: 15000 });
                                
                                posts = await page.$$eval(selector, links => 
                                    links
                                        .map(link => link.href)
                                        .filter(href => href && href.includes('/p/'))
                                        .slice(0, 3) // Very limited number
                                );
                                
                                if (posts.length > 0) {
                                    console.log(`✅ Found ${posts.length} posts`);
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
                        
                        // Process only 1-2 posts maximum in safe mode
                        const postsToEngage = Math.min(2, posts.length);
                        console.log(`🎯 Will process ${postsToEngage} posts (safe mode)`);

                        // Process posts with extreme caution
                        for (let i = 0; i < postsToEngage; i++) {
                            if (likesThisHour >= maxLikesPerHour) break;

                            const postUrl = posts[i];
                            
                            try {
                                console.log(`📝 Processing post ${i + 1}/${postsToEngage}`);
                                
                                await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 45000 });
                                await delay(5000); // Wait for post to fully load

                                // Very careful like attempt
                                let liked = false;
                                try {
                                    const likeButton = await page.$('svg[aria-label="Like"]');
                                    if (likeButton) {
                                        // Scroll to button first (more human-like)
                                        await likeButton.scrollIntoView();
                                        await delay(2000);
                                        
                                        await likeButton.click();
                                        liked = true;
                                        likesThisHour++;
                                        results.totalLikes++;
                                        console.log(`❤️ Post liked safely! Total: ${results.totalLikes}/${maxLikesPerHour}`);
                                        
                                        // Charge for event
                                        try {
                                            await Actor.chargeEvent('engagement_action', 1);
                                        } catch (chargeError) {
                                            console.log('Note: Event charging not available in test mode');
                                        }
                                    }
                                } catch (e) {
                                    console.log('❤️ Like button not accessible or post already liked');
                                }

                                results.processedPosts++;

                                // Very long delay between actions (human-like)
                                const longDelay = delayBetweenActions * 1000 + Math.random() * 30000;
                                console.log(`⏱️ Safe delay: ${Math.round(longDelay/1000)}s before next action...`);
                                await delay(longDelay);

                            } catch (error) {
                                console.error('❌ Error processing post:', error.message);
                                results.errors.push(`Post error: ${error.message}`);
                            }
                        }

                        // Very long delay between hashtags (if processing multiple)
                        console.log(`⏱️ Long delay before next hashtag for account safety...`);
                        await delay(120000 + Math.random() * 60000); // 2-3 minutes

                    } catch (error) {
                        console.error(`❌ Error processing hashtag #${hashtag}:`, error.message);
                        results.errors.push(`Hashtag ${hashtag}: ${error.message}`);
                        results.skippedHashtags++;
                    }
                }

                // Store results
                await Actor.pushData(results);
                console.log('\n📊 Instagram AI Agent Results (Safe Mode):');
                console.log(`- Login status: ${results.loginStatus}`);
                console.log(`- Processed hashtags: ${results.processedHashtags}`);
                console.log(`- Skipped hashtags: ${results.skippedHashtags}`);
                console.log(`- Processed posts: ${results.processedPosts}`);
                console.log(`- Total likes: ${results.totalLikes}/${maxLikesPerHour}`);
                console.log(`- Direct connection used: Yes (safer for account)`);
                console.log(`- Errors: ${results.errors.length}`);
                
                if (results.totalLikes > 0) {
                    console.log(`🎉 Safe campaign completed! Liked ${results.totalLikes} posts`);
                    console.log(`💡 Account safety maintained with conservative approach`);
                } else {
                    console.log(`⚠️ No engagement completed - check account status`);
                }

            } catch (error) {
                console.error('❌ Fatal error:', error.message);
                results.success = false;
                results.errors.push(`Fatal: ${error.message}`);
                await Actor.pushData(results);
            }
        }
    });

    await crawler.run(['https://www.instagram.com']);
    console.log('✅ Instagram AI Agent completed in safe mode!');
});