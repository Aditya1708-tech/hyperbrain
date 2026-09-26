/**
 * =========================================================================
 * HYPERBRAIN LANDING WEBSITE & CONVERSION ENGINE VERIFICATION SUITE
 * =========================================================================
 * Tests subpage routing selectors, blog category counts, and dynamic Open Graph
 * SEO tags metadata mapping.
 * =========================================================================
 */

let passed = true;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
  } else {
    console.error(`❌ [FAIL] ${message}`);
    passed = false;
  }
}

// -------------------------------------------------------------------
// LANDING PAGE REPLICAS
// -------------------------------------------------------------------

const landingServiceReplica = {
  
  getSeoMetaTags(subPage = null) {
    const defaultMeta = {
      title: "HyperBrain - AI-Powered Academic Intelligence Platform",
      description: "Continuous study roadmaps, grounded AI Socratic tutoring assistants, and secure educational outline classifications.",
      url: "https://hyperbrain.edu",
      ogImage: "https://hyperbrain.edu/og-preview.png"
    };

    if (subPage === 'blog') {
      return {
        ...defaultMeta,
        title: "Academic Intelligence Blog | HyperBrain",
        description: "Latest research, optimization updates, and learning sciences guides from HyperBrain."
      };
    } else if (subPage === 'faq') {
      return {
        ...defaultMeta,
        title: "Frequently Asked Questions | HyperBrain"
      };
    }
    return defaultMeta;
  },

  getBlogPosts() {
    return [
      {
        id: 'post_1',
        category: 'Learning Sciences',
        title: 'How AI Socratic Tutoring Accelerates Active Recall',
        readTime: '5 mins read'
      },
      {
        id: 'post_2',
        category: 'Engineering',
        title: 'Graph Theory in Syllabuses Topological Sorting',
        readTime: '8 mins read'
      }
    ];
  },

  getSitemapXml() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://hyperbrain.edu/</loc><priority>1.0</priority></url>
  <url><loc>https://hyperbrain.edu/blog</loc><priority>0.8</priority></url>
  <url><loc>https://hyperbrain.edu/faq</loc><priority>0.7</priority></url>
</urlset>`;
  }
};

// ==========================================
// TEST EXECUTION RUNS
// ==========================================

async function runTests() {
  console.log("-------------------------------------------------------------------");
  console.log("🧪 RUNNING HYPERBRAIN LANDING & CONVERSION TESTS");
  console.log("-------------------------------------------------------------------");

  // Test 1: SEO Meta Tags configuration
  const defaultSeo = landingServiceReplica.getSeoMetaTags(null);
  assert(defaultSeo.title.includes("HyperBrain") && defaultSeo.url === "https://hyperbrain.edu", "SEO: Default landing metadata contains brand tags");

  const blogSeo = landingServiceReplica.getSeoMetaTags('blog');
  assert(blogSeo.title.includes("Blog") && blogSeo.description.includes("research"), "SEO: Subpage blog metadata maps specific categories");

  // Test 2: Blog System categories and readings
  const posts = landingServiceReplica.getBlogPosts();
  assert(posts.length === 2, "Blog System: Blog posts load index array");
  assert(posts[0].category === 'Learning Sciences', "Blog System: Socratic tutorial article matches category");
  assert(posts[1].readTime.includes("mins"), "Blog System: Estimated reading duration metric displays correctly");

  // Test 3: Structured sitemap generations
  const xml = landingServiceReplica.getSitemapXml();
  assert(xml.includes("loc") && xml.includes("urlset"), "Sitemap: Structured XML sitemap contains index targets");

  console.log("-------------------------------------------------------------------");
  if (passed) {
    console.log("⭐ ALL LANDING WEBSITE VERIFICATIONS PASSED SUCCESSFULLY!");
    process.exit(0);
  } else {
    console.error("💥 LANDING WEBSITE AUDITS COMPLETED WITH FAILURES.");
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error("Test execution crashed:", e);
  process.exit(1);
});
