// Instagram AI Agent - Flattened Configuration Version
import { Actor } from 'apify';
import { PuppeteerCrawler } from 'crawlee';

await Actor.main(async () => {
    console.log('🤖 Starting Instagram AI Agent...');
    
    // Get input configuration (now flattened)
    const input = await Actor.getInput() ?? {};
    const {
        username,
        password,
        openaiApiKey = null,
        targetHashtags = ['automation', 'ai'],
        
        // Engagement settings (flattened)
        targetAudience = 'General audience',
        engagementRate = 15,
        commentRate = 30,
        followRate = 5,
        
        // Content strategy (flattened)
        brandTone = 'friendly',
        autoPost = false,
        contentThemes = [],
        
        // Posting schedule (flattened)
        enableScheduledPosting = false,
        postingFrequency = 'daily',
        preferredPostingTimes = [],
        
        // Safety limits (flattened)
        maxLikesPerHour = 30,
        maxCommentsPerHour = 10,
        maxFollowsPerHour = 20,
        delayBetweenActions = 30,
        
        // Advanced settings (flattened)
        useProxies = true,
        maxConcurrency = 1,
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
    console.log(`- Target audience: ${targetAudience}`);
    console.log(`- Engagement rate: ${engagementRate}%`);
    console.log(`- Comment rate: ${commentRate}%`);
    console.log(`- Follow rate: ${followRate}%`);
    console.log(`- Brand tone: ${brandTone}`);
    console.log(`- Max likes per hour: ${maxLikesPerHour}`);
    console.log(`- Delay between actions: ${delayBetweenActions}s`);
    console.log(`- AI features: ${openaiApiKey ? 'Enabled' : 'Basic mode'}`);
    console.log(`- Proxy usage: ${useProxies ? 'Enabled' : 'Disabled'}`);
    console.log(`- Auto-posting: ${autoPost ? 'Enabled' : 'Disabled'}`);

    // Rate limiting counters
    let likesThisHour = 0;
    let commentsThisHour = 0;
    let followsThisHour = 0;
    let lastHourReset = Date.now();

    // Reset counters every hour
    const resetCountersIfNeeded = () => {
        if (Date.now() - lastHourReset > 3600000) { // 1 hour
            likesThisHour = 0;
            commentsThisHour = 0;
            followsThisHour = 0;
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
        configuration: {
            username,
            hashtags: targetHashtags,
            engagementRate,
            commentRate,
            followRate,
            maxLikesPerHour,
            maxCommentsPerHour,
            maxFollowsPerHour,
            targetAudience,
            brandTone
        },
        timestamp: new Date().toISOString(),
        success: true
    };

    // Create crawler with advanced settings
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
                    '--disable-gpu'
                ]
            }
        },
        maxRequestsPerCrawl: 1,
        sessionPoolOptions: {
            maxPoolSize: maxConcurrency,
            sessionOptions: {
                maxUsageCount: 1
            }
        }
    };

    // Add proxy configuration if enabled
    if (useProxies) {
        crawlerOptions.proxyConfiguration = await Actor.createProxyConfiguration({
            groups: ['RESIDENTIAL']
        });
        console.log('🌐 Using Apify residential proxies');
    }

    const crawler = new PuppeteerCrawler({
        ...crawlerOptions,
        async requestHandler({ page }) {
            try {
                // Set timeout for session
                setTimeout(() => {
                    console.log('⏰ Session timeout reached');
                }, sessionTimeout * 60 * 1000);

                // Login to Instagram
                console.log('🔐 Logging into Instagram...');
                await page.goto('https://www.instagram.com/accounts/login/', { 
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });

                // Wait for login form and enter credentials
                await page.waitForSelector('input[name="username"]', { timeout: 15000 });
                await page.type('input[name="username"]', username, { delay: 100 });
                await page.waitForTimeout(1000);
                await page.type('input[name="password"]', password, { delay: 100 });
                
                // Click login
                await page.click('button[type="submit"]');
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

                // Handle potential popups
                try {
                    await page.waitForTimeout(3000);
                    const notNowButton = await page.$x("//button[contains(text(), 'Not Now')]");
                    if (notNowButton.length > 0) {
                        await notNowButton[0].click();
                        await page.waitForTimeout(2000);
                    }
                } catch (e) {
                    console.log('No popup found');
                }

                // Check if login was successful
                const currentUrl = page.url();
                if (currentUrl.includes('/accounts/login/')) {
                    throw new Error('Login failed - check credentials');
                }

                console.log('✅ Successfully logged into Instagram');

                // Process each target hashtag
                for (const hashtag of targetHashtags.slice(0, 3)) { // Limit hashtags for safety
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

                        // Calculate how many posts to engage with based on engagement rate
                        const postsToEngage = Math.ceil(posts.length * (engagementRate / 100));
                        console.log(`🎯 Will engage with ${postsToEngage} posts (${engagementRate}% rate)`);

                        // Process posts
                        for (let i = 0; i < Math.min(postsToEngage, posts.length); i++) {
                            if (likesThisHour >= maxLikesPerHour) break;

                            const postUrl = posts[i];

                            try {
                                console.log(`📝 Processing post ${i + 1}/${postsToEngage}: ${postUrl}`);
                                
                                await page.goto(postUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                                await page.waitForSelector('article', { timeout: 10000 });

                                // Try to like the post
                                const likeButton = await page.$('svg[aria-label="Like"]');
                                if (likeButton) {
                                    await likeButton.click();
                                    likesThisHour++;
                                    results.totalLikes++;
                                    console.log(`❤️ Post liked! (${likesThisHour}/${maxLikesPerHour} this hour)`);
                                    
                                    // Charge for event (monetization)
                                    await Actor.chargeEvent('engagement_action', 1);
                                } else {
                                    console.log('❤️ Post already liked or like button not found');
                                }

                                results.processedPosts++;

                                // Human-like delay between actions
                                const delay = (delayBetweenActions * 1000) + (Math.random() * 5000);
                                await page.waitForTimeout(delay);

                            } catch (error) {
                                console.error('❌ Error processing post:', error.message);
                                results.errors.push(`Post ${postUrl}: ${error.message}`);
                            }
                        }

                        // Delay between hashtags
                        await page.waitForTimeout(Math.random() * 15000 + 10000);

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
                console.log(`- Total comments: ${results.totalComments}`);
                console.log(`- Total follows: ${results.totalFollows}`);
                console.log(`- Errors: ${results.errors.length}`);
                if (results.processedPosts > 0) {
                    console.log(`- Success rate: ${((results.processedPosts - results.errors.length) / results.processedPosts * 100).toFixed(1)}%`);
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