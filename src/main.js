// Instagram AI Agent Actor - Complete Implementation
// This Actor automates Instagram interactions using AI for content generation and engagement

import { Actor } from 'apify';
import { PuppeteerCrawler } from 'crawlee';
import OpenAI from 'openai';

// Actor main function
await Actor.main(async () => {
    console.log('🤖 Starting Instagram AI Agent...');
    
    // Get input configuration
    const input = await Actor.getInput() ?? {};
    const {
        username,
        password,
        openaiApiKey,
        targetHashtags = [],
        engagementSettings = {},
        contentStrategy = {},
        postingSchedule = {},
        safetyLimits = {
            maxLikesPerHour: 30,
            maxCommentsPerHour: 10,
            maxFollowsPerHour: 20
        }
    } = input;

    // Validate required inputs
    if (!username || !password) {
        throw new Error('Instagram username and password are required');
    }
    if (!openaiApiKey) {
        throw new Error('OpenAI API key is required for AI features');
    }

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey: openaiApiKey });

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

    // AI Content Generation Functions
    const generateCaption = async (imageDescription, brand, audience) => {
        try {
            const prompt = `Generate an engaging Instagram caption for ${brand}. 
                          Image description: ${imageDescription}
                          Target audience: ${audience}
                          Style: ${contentStrategy.tone || 'professional but friendly'}
                          Include relevant hashtags and call-to-action.
                          Max 150 words.`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 200
            });

            return completion.choices[0].message.content.trim();
        } catch (error) {
            console.error('❌ Error generating caption:', error);
            return null;
        }
    };

    const generateComment = async (postDescription, userProfile) => {
        try {
            const prompt = `Generate a natural, engaging comment for an Instagram post.
                          Post description: ${postDescription}
                          User profile: ${userProfile}
                          Style: Authentic, supportive, relevant
                          Max 20 words. No hashtags.`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 50
            });

            return completion.choices[0].message.content.trim();
        } catch (error) {
            console.error('❌ Error generating comment:', error);
            return null;
        }
    };

    // Instagram interaction functions
    const loginToInstagram = async (page) => {
        console.log('🔐 Logging into Instagram...');
        
        await page.goto('https://www.instagram.com/accounts/login/', { 
            waitUntil: 'networkidle2' 
        });

        // Wait for login form
        await page.waitForSelector('input[name="username"]', { timeout: 10000 });
        
        // Enter credentials
        await page.type('input[name="username"]', username);
        await page.type('input[name="password"]', password);
        
        // Click login button
        await page.click('button[type="submit"]');
        
        // Wait for navigation
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        
        // Handle "Save Your Login Info" popup
        try {
            await page.waitForSelector('button', { timeout: 5000 });
            const notNowButton = await page.$x("//button[contains(text(), 'Not Now')]");
            if (notNowButton.length > 0) {
                await notNowButton[0].click();
            }
        } catch (e) {
            console.log('No "Save Login Info" popup found');
        }

        console.log('✅ Successfully logged into Instagram');
    };

    const searchHashtag = async (page, hashtag) => {
        console.log(`🔍 Searching hashtag: #${hashtag}`);
        
        await page.goto(`https://www.instagram.com/explore/tags/${hashtag}/`, {
            waitUntil: 'networkidle2'
        });

        // Wait for posts to load
        await page.waitForSelector('article a', { timeout: 10000 });
        
        // Get recent posts
        const posts = await page.$$eval('article a', links => 
            links.slice(0, 9).map(link => link.href)
        );

        return posts;
    };

    const analyzePost = async (page, postUrl) => {
        try {
            await page.goto(postUrl, { waitUntil: 'networkidle2' });
            await page.waitForSelector('article', { timeout: 10000 });

            const postData = await page.evaluate(() => {
                // Extract post caption
                const captionElement = document.querySelector('article h1') || 
                                     document.querySelector('article div[data-testid="post-text"]');
                const caption = captionElement ? captionElement.innerText : '';

                // Extract user info
                const userElement = document.querySelector('article header a');
                const username = userElement ? userElement.innerText : '';

                // Check if already liked
                const likeButton = document.querySelector('article button[aria-label*="Like"]') ||
                                 document.querySelector('article button[aria-label*="Unlike"]');
                const isLiked = likeButton ? likeButton.getAttribute('aria-label').includes('Unlike') : false;

                // Get engagement metrics
                const likesElement = document.querySelector('article button span');
                const likes = likesElement ? likesElement.innerText : '0';

                return {
                    caption,
                    username,
                    isLiked,
                    likes,
                    url: window.location.href
                };
            });

            return postData;
        } catch (error) {
            console.error('❌ Error analyzing post:', error);
            return null;
        }
    };

    const likePost = async (page) => {
        try {
            resetCountersIfNeeded();
            
            if (likesThisHour >= safetyLimits.maxLikesPerHour) {
                console.log('⚠️ Like limit reached for this hour');
                return false;
            }

            const likeButton = await page.$('article button[aria-label*="Like"]');
            if (likeButton) {
                await likeButton.click();
                likesThisHour++;
                console.log('❤️ Post liked');
                
                // Human-like delay
                await page.waitForTimeout(Math.random() * 3000 + 2000);
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Error liking post:', error);
            return false;
        }
    };

    const commentOnPost = async (page, postData) => {
        try {
            resetCountersIfNeeded();
            
            if (commentsThisHour >= safetyLimits.maxCommentsPerHour) {
                console.log('⚠️ Comment limit reached for this hour');
                return false;
            }

            // Generate AI comment
            const aiComment = await generateComment(postData.caption, postData.username);
            if (!aiComment) return false;

            // Find comment input
            const commentInput = await page.$('article textarea[placeholder*="comment"]');
            if (!commentInput) return false;

            // Type comment
            await commentInput.click();
            await commentInput.type(aiComment);
            
            // Submit comment
            const postButton = await page.$('article button[type="submit"]');
            if (postButton) {
                await postButton.click();
                commentsThisHour++;
                console.log(`💬 Commented: "${aiComment}"`);
                
                // Human-like delay
                await page.waitForTimeout(Math.random() * 5000 + 3000);
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Error commenting on post:', error);
            return false;
        }
    };

    const followUser = async (page, username) => {
        try {
            resetCountersIfNeeded();
            
            if (followsThisHour >= safetyLimits.maxFollowsPerHour) {
                console.log('⚠️ Follow limit reached for this hour');
                return false;
            }

            await page.goto(`https://www.instagram.com/${username}/`, {
                waitUntil: 'networkidle2'
            });

            const followButton = await page.$('button:has-text("Follow")');
            if (followButton) {
                await followButton.click();
                followsThisHour++;
                console.log(`👥 Followed @${username}`);
                
                // Human-like delay
                await page.waitForTimeout(Math.random() * 4000 + 2000);
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Error following user:', error);
            return false;
        }
    };

    // Main automation logic
    const runEngagementCampaign = async () => {
        const crawler = new PuppeteerCrawler({
            launchContext: {
                launchOptions: {
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                }
            },
            async requestHandler({ page }) {
                await loginToInstagram(page);

                const results = {
                    totalLikes: 0,
                    totalComments: 0,
                    totalFollows: 0,
                    processedPosts: 0,
                    errors: []
                };

                // Process each target hashtag
                for (const hashtag of targetHashtags) {
                    try {
                        console.log(`\n🎯 Processing hashtag: #${hashtag}`);
                        
                        const posts = await searchHashtag(page, hashtag);
                        
                        for (const postUrl of posts.slice(0, 5)) { // Limit posts per hashtag
                            try {
                                const postData = await analyzePost(page, postUrl);
                                if (!postData) continue;

                                results.processedPosts++;
                                console.log(`\n📝 Processing post by @${postData.username}`);

                                // AI-driven engagement decisions
                                const shouldEngage = await evaluateEngagement(postData);
                                
                                if (shouldEngage.like && !postData.isLiked) {
                                    const liked = await likePost(page);
                                    if (liked) results.totalLikes++;
                                }

                                if (shouldEngage.comment) {
                                    const commented = await commentOnPost(page, postData);
                                    if (commented) results.totalComments++;
                                }

                                if (shouldEngage.follow) {
                                    const followed = await followUser(page, postData.username);
                                    if (followed) results.totalFollows++;
                                }

                                // Human-like delay between posts
                                await page.waitForTimeout(Math.random() * 10000 + 5000);

                            } catch (error) {
                                console.error('❌ Error processing post:', error);
                                results.errors.push(error.message);
                            }
                        }

                        // Delay between hashtags
                        await page.waitForTimeout(Math.random() * 15000 + 10000);

                    } catch (error) {
                        console.error(`❌ Error processing hashtag #${hashtag}:`, error);
                        results.errors.push(`Hashtag ${hashtag}: ${error.message}`);
                    }
                }

                // Store results
                await Actor.pushData(results);
                console.log('\n📊 Engagement Campaign Results:', results);
            }
        });

        await crawler.run(['https://www.instagram.com']);
    };

    // AI-driven engagement evaluation
    const evaluateEngagement = async (postData) => {
        try {
            const prompt = `Analyze this Instagram post for engagement potential:
                          Caption: "${postData.caption}"
                          User: @${postData.username}
                          Current likes: ${postData.likes}
                          
                          Target audience: ${engagementSettings.targetAudience || 'general'}
                          Brand voice: ${contentStrategy.tone || 'friendly'}
                          
                          Should we: like (yes/no), comment (yes/no), follow (yes/no)?
                          Return as JSON: {"like": boolean, "comment": boolean, "follow": boolean, "reasoning": "why"}`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 150
            });

            const response = JSON.parse(completion.choices[0].message.content);
            console.log(`🤖 AI Decision: ${response.reasoning}`);
            return response;

        } catch (error) {
            console.error('❌ Error in AI evaluation:', error);
            return { like: false, comment: false, follow: false };
        }
    };

    // Content posting function (if enabled)
    const postContent = async () => {
        if (!contentStrategy.autoPost) return;

        console.log('📸 Auto-posting content...');
        // Implementation for automated posting would go here
        // This would include image generation/selection and caption creation
    };

    // Execute the main automation
    try {
        await runEngagementCampaign();
        
        if (contentStrategy.autoPost) {
            await postContent();
        }

        console.log('✅ Instagram AI Agent completed successfully!');

    } catch (error) {
        console.error('❌ Fatal error:', error);
        throw error;
    }
});

// Pay-Per-Event charging for monetization
const chargeForEvent = async (eventType, count = 1) => {
    try {
        await Actor.chargeEvent(eventType, count);
        console.log(`💰 Charged for ${count} ${eventType} event(s)`);
    } catch (error) {
        console.error('❌ Error charging for event:', error);
    }
};

// Usage examples for different event types:
// await chargeForEvent('engagement_action', 1); // Per like/comment/follow
// await chargeForEvent('ai_content_generation', 1); // Per AI-generated content
// await chargeForEvent('post_analysis', 1); // Per post analyzed