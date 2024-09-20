const express = require('express');
const CDP = require('chrome-remote-interface');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/scrape-reviews', async (req, res) => {
    const { businessName } = req.query;

    if (!businessName) {
        return res.status(400).json({ error: 'Business name is required' });
    }

    let client;
    try {
        client = await CDP();
        const { Page, Runtime } = client;

        await Page.enable();
        await Runtime.enable();

        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(businessName)}`;
        await Page.navigate({ url });
        await Page.loadEventFired();

        const result = await Runtime.evaluate({
            expression: `
                (async () => {
                    const reviews = [];
                    const ratingElement = document.querySelector('span[aria-label^="Rated"]');
                    const reviewCountElement = document.querySelector('span[data-attrid="number of reviews"]');

                    // Scroll to load more reviews
                    const loadMoreButton = document.querySelector('button[aria-label="More reviews"]');
                    if (loadMoreButton) {
                        loadMoreButton.click();
                        await new Promise(resolve => setTimeout(resolve, 2000)); // wait for reviews to load
                    }

                    const reviewElements = document.querySelectorAll('.section-review');
                    reviewElements.forEach(element => {
                        const username = element.querySelector('.section-review-title').innerText;
                        const datetime = element.querySelector('.section-review-publish-date').innerText;
                        const rating = element.querySelector('.section-review-stars').getAttribute('aria-label');
                        const body = element.querySelector('.section-review-review-content').innerText;

                        reviews.push({ username, datetime, rating, body });
                    });

                    return {
                        averageRating: ratingElement ? ratingElement.innerText : null,
                        totalReviews: reviewCountElement ? reviewCountElement.innerText : null,
                        latestReviews: reviews.slice(0, 50)
                    };
                })();
            `
        });

        await client.close();

        res.json(result.result.value);
    } catch (error) {
        console.error(error);
        if (client) {
            await client.close();
        }
        res.status(500).json({ error: 'Error scraping reviews' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
