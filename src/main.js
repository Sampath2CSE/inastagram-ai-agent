// Instagram AI Agent - Robust Version with Better Error Handling
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

    // Rate limiting counters
    let likesThisHour = 0;
    let lastHourReset = Date.now();

    const resetCountersIfNeeded = () => {
        if (Date.now() - lastHourReset > 3600000) {
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
        skippedHashtags: 0,
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

                // Set user agent and viewport
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
                await page.setViewport({ width: 1366, height: 768 });

                // Login to Instagram
                console.log('🔐 Logging into Instagram...');
                await page.goto('https://www.instagram.com/accounts/login/', { 
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });

                // Wait for login form and enter credentials
                await page.waitForSelector('input[name="username"]', { timeout: 15000 });
                
                await page.click('input[name="username"]', { clickCount: 3 });
                await page.type('input[name="username"]', username, { delay: 100 });
                await delay(1000);
                
                await page.click('input[name="password"]', { clickCount: 3 });
                await page.type('input[name="password"]', password, { delay: 100 });
                await delay(1000);
                
                // Click login
                await page.click('button[type="submit"]');
                
                try {
                    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
                } catch (navError) {
                    console.log('Navigation timeout, checking current state...');
                }

                // Handle popups
                await delay(3000);
                
                try {
                    const notNowButtons = await page.$x("//button[contains(text(), 'Not Now') or contains(text(), 'Not now')]");
                    if (notNowButtons.length > 0) {
                        await notNowButtons[0].click();
                        console.log('✅ Dismissed popup');
                        await delay(2000);
                    }
                } catch (e) {
                    console.log('No popup found');
                }

                // Verify login
                const currentUrl = page.url();
                console.log(`Current URL after login: ${currentUrl}`);
                
                if (currentUrl.includes('/accounts/login/') || currentUrl.includes('/challenge/')) {
                    throw new Error('Login failed - check credentials or account status.');
                }

                console.log('✅ Successfully logged into Instagram');

                // Process each target hashtag
                for (const hashtag of targetHashtags.slice(0, 3)) {
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

                        await delay(3000); // Give page time to load

                        // Try multiple selectors for posts
                        let posts = [];
                        const selectors = [
                            'article a[href*="/p/"]',  // Most specific
                            'a[href*="/p/"]',          // Broader
                            'article a',               // Original
                            'div[role="button"] a',    // Alternative
                            '[data-testid="post"] a'  // Test ID based
                        ];

                        for (const selector of selectors) {
                            try {
                                console.log(`🔍 Trying selector: ${selector}`);
                                await page.waitForSelector(selector, { timeout: 5000 });
                                
                                posts = await page.$$eval(selector, links => 
                                    links
                                        .map(link => link.href)
                                        .filter(href => href && href.includes('/p/'))
                                        .slice(0, 9) // Limit to first 9 posts
                                );
                                
                                if (posts.length > 0) {
                                    console.log(`✅ Found ${posts.length} posts using selector: ${selector}`);
                                    break;
                                }
                            } catch (selectorError) {
                                console.log(`❌ Selector ${selector} failed: ${selectorError.message}`);
                                continue;
                            }
                        }

                        if (posts.length === 0) {
                            console.log(`⚠️ No posts found for hashtag #${hashtag}, skipping...`);
                            results.skippedHashtags++;
                            continue;
                        }

                        console.log(`📱 Found ${posts.length} posts for #${hashtag}`);
                        results.processedHashtags++;

                        // Calculate engagement
                        const postsToEngage = Math.min(3, Math.ceil(posts.length * (engagementRate / 100)));
                        console.log(`🎯 Will engage with ${postsToEngage} posts (${engagementRate}% rate)`);

                        // Process posts
                        for (let i = 0; i < postsToEngage; i++) {
                            if (likesThisHour >= maxLikesPerHour) break;

                            const postUrl = posts[i];

                            try {
                                const postId = postUrl.split('/p/')[1]?.split('/')[0] || 'unknown';
                                console.log(`📝 Processing post ${i + 1}/${postsToEngage}: ${postId}`);
                                
                                await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                                
                                // Wait for post to load
                                await page.waitForSelector('article', { timeout: 10000 });
                                await delay(2000);

                                // Try to find and click like button
                                let liked = false;
                                const likeSelectors = [
                                    'svg[aria-label="Like"]',
                                    'button[aria-label="Like"]',
                                    '[data-testid="like-button"]',
                                    'span[aria-label="Like"]'
                                ];

                                for (const likeSelector of likeSelectors) {
                                    try {
                                        const likeButton = await page.$(likeSelector);
                                        if (likeButton) {
                                            await likeButton.click();
                                            liked = true;
                                            likesThisHour++;
                                            results.totalLikes++;
                                            console.log(`❤️ Post liked! (${likesThisHour}/${maxLikesPerHour} this hour)`);
                                            
                                            // Charge for event
                                            try {
                                                await Actor.chargeEvent('engagement_action', 1);
                                                console.log('💰 Charged for engagement action');
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
                                    console.log('❤️ Post already liked or like button not found');
                                }

                                results.processedPosts++;

                                // Human-like delay
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
                        results.skippedHashtags++;
                    }
                }

                // Store results
                await Actor.pushData(results);
                console.log('\n📊 Instagram AI Agent Results:');
                console.log(`- Processed hashtags: ${results.processedHashtags}`);
                console.log(`- Skipped hashtags: ${results.skippedHashtags}`);
                console.log(`- Processed posts: ${results.processedPosts}`);
                console.log(`- Total likes: ${results.totalLikes}`);
                console.log(`- Proxy used: ${results.proxyUsed ? 'Yes' : 'No'}`);
                if (results.actualProxyUsed) {
                    console.log(`- Actual proxy: ${results.actualProxyUsed}`);
                }
                console.log(`- Errors: ${results.errors.length}`);
                
                if (results.totalLikes > 0) {
                    console.log(`🎉 Campaign successful! Liked ${results.totalLikes} posts`);
                } else if (results.skippedHashtags > 0) {
                    console.log(`⚠️ No posts found for hashtags. Try different hashtags like: automation, ai, business, tech, marketing`);
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