// Instagram AI Agent - Fixed with Proper Proxy Support
import { Actor } from 'apify';
import { PuppeteerCrawler } from 'crawlee';

// Helper function for delays (compatible with all Puppeteer versions)
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

    // Rate limiting counters
    let likesThisHour = 0;
    let lastHourReset = Date.now();

    // Reset counters every hour
    const resetCountersIfNeeded = () => {
        if (Date.now() - lastHourReset > 3600000) { // 1 hour
            likesThisHour = 0;
            lastHourReset = Date.now();
            console.log('🔄 Rate limit counters reset');
        }
    };

    // Initialize results
    const results = {
        totalLikes: 0,
        totalComments: 0,
        totalFollows: 0,
        processedPosts: 0,
        processedHashtags: 0,
        errors: [],
        proxyUsed: useProxies,
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
            
            // Test proxy
            const proxyInfo = await proxyConfiguration.newProxyInfo();
            console.log(`🌐 Using proxy: ${proxyInfo.hostname}:${proxyInfo.port}`);
            results.proxyInfo = `${proxyInfo.hostname}:${proxyInfo.port}`;
        } catch (error) {
            console.log('⚠️ Proxy setup failed:', error.message);
            console.log('⚠️ Continuing without proxies');
            useProxies = false;
            results.proxyUsed = false;
        }
    }

    // Create crawler with proper proxy configuration
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
                ]
            }
        },
        maxRequestsPerCrawl: 1,
        // Add proxy configuration to crawler
        proxyConfiguration: proxyConfiguration,
        
        // Configure session pool for proxy rotation
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
                // Log proxy information if available
                if (proxyInfo) {
                    console.log(`🌐 Using proxy: ${proxyInfo.hostname}:${proxyInfo.port} (${proxyInfo.countryCode || 'Unknown'})`);
                    results.actualProxyUsed = `${proxyInfo.hostname}:${proxyInfo.port}`;
                } else {
                    console.log('🌐 No proxy in use (direct connection)');
                }

                // Set user agent to look more natural
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

                // Set viewport
                await page.setViewport({ width: 1366, height: 768 });

                // Login to Instagram
                console.log('🔐 Logging into Instagram...');
                await page.goto('https://www.instagram.com/accounts/login/', { 
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });

                // Wait for login form and enter credentials
                await page.waitForSelector('input[name="username"]', { timeout: 15000 });
                
                // Clear any existing text and type username
                await page.click('input[name="username"]', { clickCount: 3 });
                await page.type('input[name="username"]', username, { delay: 100 });
                await delay(1000);
                
                // Clear any existing text and type password
                await page.click('input[name="password"]', { clickCount: 3 });
                await page.type('input[name="password"]', password, { delay: 100 });
                await delay(1000);
                
                // Click login
                await page.click('button[type="submit"]');
                
                // Wait for navigation or error
                try {
                    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
                } catch (navError) {
                    console.log('Navigation timeout, checking current state...');
                }

                // Handle potential popups and verification steps
                await delay(3000);
                
                // Check for "Save Your Login Info" popup
                try {
                    const notNowButtons = await page.$x("//button[contains(text(), 'Not Now') or contains(text(), 'Not now')]");
                    if (notNowButtons.length > 0) {
                        await notNowButtons[0].click();
                        console.log('✅ Dismissed "Save Login Info" popup');
                        await delay(2000);
                    }
                } catch (e) {
                    console.log('No "Save Login Info" popup found');
                }

                // Check for notifications popup
                try {
                    const notNowButtons = await page.$x("//button[contains(text(), 'Not Now')]");
                    if (notNowButtons.length > 0) {
                        await notNowButtons[0].click();
                        console.log('✅ Dismissed notifications popup');
                        await delay(2000);
                    }
                } catch (e) {
                    console.log('No notifications popup found');
                }

                // Verify login was successful
                const currentUrl = page.url();
                console.log(`Current URL after login: ${currentUrl}`);
                
                if (currentUrl.includes('/accounts/login/') || currentUrl.includes('/challenge/')) {
                    // Check for specific error messages
                    const errorElements = await page.$$('div[role="alert"], .error-message, #slfErrorAlert');
                    if (errorElements.length > 0) {
                        const errorText = await page.evaluate(el => el.textContent, errorElements[0]);
                        throw new Error(`Login failed: ${errorText}`);
                    }
                    throw new Error('Login failed - still on login page. Check credentials or account status.');
                }

                console.log('✅ Successfully logged into Instagram');

                // Process each target hashtag
                for (const hashtag of targetHashtags.slice(0, 2)) { // Limit hashtags for safety
                    resetCountersIfNeeded();
                    
                    if (likesThisHour >= maxLikesPerHour) {
                        console.log('⚠️ Hourly like limit reached');
                        break;
                    }

                    try {
                        console.log(`\n🎯 Processing hashtag: #${hashtag}`);
                        
                        // Navigate to hashtag page
                        await page.goto(`https://www.instagram.com/explore/tags/${hashtag}/`, {
                            waitUntil: 'networkidle2',
                            timeout: 30000
                        });

                        // Wait for posts to load
                        await page.waitForSelector('article a', { timeout: 15000 });
                        
                        // Get recent posts
                        const posts = await page.$$eval('article a', links => 
                            links.slice(0, 6).map(link => link.href).filter(href => href.includes('/p/'))
                        );

                        console.log(`📱 Found ${posts.length} posts for #${hashtag}`);
                        results.processedHashtags++;

                        // Calculate how many posts to engage with
                        const postsToEngage = Math.min(3, Math.ceil(posts.length * (engagementRate / 100)));
                        console.log(`🎯 Will engage with ${postsToEngage} posts (${engagementRate}% rate)`);

                        // Process posts
                        for (let i = 0; i < postsToEngage; i++) {
                            if (likesThisHour >= maxLikesPerHour) break;

                            const postUrl = posts[i];

                            try {
                                console.log(`📝 Processing post ${i + 1}/${postsToEngage}: ${postUrl.split('/p/')[1]?.split('/')[0] || 'unknown'}`);
                                
                                await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                                await page.waitForSelector('article', { timeout: 10000 });

                                // Wait a moment for everything to load
                                await delay(2000);

                                // Try to like the post
                                const likeButton = await page.$('svg[aria-label="Like"]');
                                if (likeButton) {
                                    await likeButton.click();
                                    likesThisHour++;
                                    results.totalLikes++;
                                    console.log(`❤️ Post liked! (${likesThisHour}/${maxLikesPerHour} this hour)`);
                                    
                                    // Charge for event (monetization)
                                    try {
                                        await Actor.chargeEvent('engagement_action', 1);
                                        console.log('💰 Charged for engagement action');
                                    } catch (chargeError) {
                                        console.log('Note: Event charging not available in test mode');
                                    }
                                } else {
                                    console.log('❤️ Post already liked or like button not found');
                                }

                                results.processedPosts++;

                                // Human-like delay between actions
                                const actionDelay = (delayBetweenActions * 1000) + (Math.random() * 5000);
                                console.log(`⏱️ Waiting ${Math.round(actionDelay/1000)}s before next action...`);
                                await delay(actionDelay);

                            } catch (error) {
                                console.error('❌ Error processing post:', error.message);
                                results.errors.push(`Post error: ${error.message}`);
                            }
                        }

                        // Delay between hashtags
                        const hashtagDelay = Math.random() * 15000 + 10000;
                        console.log(`⏱️ Waiting ${Math.round(hashtagDelay/1000)}s before next hashtag...`);
                        await delay(hashtagDelay);

                    } catch (error) {
                        console.error(`❌ Error processing hashtag #${hashtag}:`, error.message);
                        results.errors.push(`Hashtag ${hashtag}: ${error.message}`);
                    }
                }

                // Store results
                await Actor.pushData(results);
                console.log('\n📊 Instagram AI Agent Results:');
                console.log(`- Processed hashtags: ${results.processedHashtags}`);
                console.log(`- Processed posts: ${results.processedPosts}`);
                console.log(`- Total likes: ${results.totalLikes}`);
                console.log(`- Proxy used: ${results.proxyUsed ? 'Yes' : 'No'}`);
                if (results.actualProxyUsed) {
                    console.log(`- Actual proxy: ${results.actualProxyUsed}`);
                }
                console.log(`- Errors: ${results.errors.length}`);
                if (results.errors.length > 0) {
                    console.log('❌ Errors:', results.errors);
                }

            } catch (error) {
                console.error('❌ Fatal error:', error.message);
                results.success = false;
                results.errors.push(`Fatal: ${error.message}`);
                await Actor.pushData(results);
                throw error;
            }
        }
    });

    await crawler.run(['https://www.instagram.com']);
    console.log('✅ Instagram AI Agent completed successfully!');
});