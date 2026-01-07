// Test for vector database connection
const { QdrantClient } = require('@qdrant/js-client-rest');

// Load environment variables
require('dotenv').config();

async function testVectorDBConnection() {
  console.log('Testing vector database connection...');
  
  // Check if required environment variables are set
  if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY) {
    console.log('✗ QDRANT_URL and QDRANT_API_KEY environment variables must be set');
    process.exit(1);
  }
  
  console.log(`✓ Environment variables found`);
  console.log(`  QDRANT_URL: ${process.env.QDRANT_URL}`);
  
  // Initialize Qdrant client
  console.log('Initializing Qdrant client...');
  const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    https: true
  });
  
  try {
    // Test connection by getting collections list
    console.log('Testing connection by retrieving collections list...');
    const collections = await qdrant.getCollections();
    console.log('✓ Vector database connection successful');
    console.log('✓ Service is accessible');
    
    // Display collections info
    if (collections.collections && collections.collections.length > 0) {
      console.log(`✓ Found ${collections.collections.length} collections:`);
      collections.collections.forEach((collection, index) => {
        console.log(`  ${index + 1}. ${collection.name} (Status: ${collection.status})`);
      });
    } else {
      console.log('⚠ No collections found in the database');
    }
    
    // Test collection access if QDRANT_COLLECTION_PRICE is defined
    if (process.env.QDRANT_COLLECTION_PRICE) {
      console.log(`\nTesting access to collection '${process.env.QDRANT_COLLECTION_PRICE}'...`);
      try {
        const collectionInfo = await qdrant.getCollection(process.env.QDRANT_COLLECTION_PRICE);
        console.log(`✓ Collection '${process.env.QDRANT_COLLECTION_PRICE}' exists`);
        console.log(`✓ Collection status: ${collectionInfo.status}`);
        console.log(`✓ Collection vectors count: ${collectionInfo.vectors_count || 0}`);
      } catch (collectionError) {
        console.log(`⚠ Collection '${process.env.QDRANT_COLLECTION_PRICE}' does not exist or is not accessible`);
        console.log('  This may be expected if the collection has not been created yet');
      }
    }
    
    // Test search functionality if QDRANT_COLLECTION_PRICE is defined
    if (process.env.QDRANT_COLLECTION_PRICE) {
      try {
        console.log(`\nTesting search functionality in collection '${process.env.QDRANT_COLLECTION_PRICE}'...`);
        // First check if collection has vectors
        const collectionInfo = await qdrant.getCollection(process.env.QDRANT_COLLECTION_PRICE);
        console.log(`Collection info:`, JSON.stringify(collectionInfo, null, 2));
        
        // Test with a simple query
        const searchResults = await qdrant.search(process.env.QDRANT_COLLECTION_PRICE, {
          limit: 5,
          with_payload: true,
          params: { hnsw_ef: 128 },
          query: "EDISON DC 30 квт"
        });
        
        console.log(`✓ Search completed successfully, found ${searchResults.length} results`);
        if (searchResults.length > 0) {
          console.log('Sample results:');
          searchResults.slice(0, 2).forEach((result, index) => {
            console.log(`  ${index + 1}. Score: ${result.score}, ID: ${result.id}`);
            if (result.payload) {
              console.log(`     Payload: ${JSON.stringify(result.payload)}`);
            }
          });
        }
      } catch (searchError) {
        console.log(`⚠ Search test failed:`, searchError.message);
        if (searchError.stack) {
          console.log('Stack trace:', searchError.stack);
        }
      }
    }
    
    console.log('\n✓ Vector database connection test passed!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Vector database connection failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

testVectorDBConnection();