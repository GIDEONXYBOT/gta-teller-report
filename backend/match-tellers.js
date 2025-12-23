import mongoose from 'mongoose';
import User from './models/User.js';
import TellerMapping from './models/TellerMapping.js';
import fetch from 'node-fetch';

class TellerMatcher {
  constructor() {
    this.reportingTellers = [];
    this.bettingTellers = [];
    this.mappings = [];
  }

  // Clean and normalize names for better matching
  normalizeName(name) {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  }

  // Extract potential identifiers from betting username
  parseBettingUsername(username) {
    // Format: "002.mary" -> { number: "002", name: "mary" }
    const match = username.match(/^(\d+)\.(.+)$/);
    if (match) {
      return {
        number: match[1],
        name: match[2],
        full: username
      };
    }
    return { number: null, name: username, full: username };
  }

  // Calculate similarity between two strings (simple Levenshtein-like)
  calculateSimilarity(str1, str2) {
    const s1 = this.normalizeName(str1);
    const s2 = this.normalizeName(str2);

    if (s1 === s2) return 1.0;

    // Simple substring matching for now
    const words1 = s1.split(' ');
    const words2 = s2.split(' ');

    let matches = 0;
    for (const word1 of words1) {
      for (const word2 of words2) {
        if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
          matches++;
          break;
        }
      }
    }

    return matches / Math.max(words1.length, words2.length);
  }

  async loadReportingTellers() {
    console.log('📊 Loading tellers from reporting system...');
    this.reportingTellers = await User.find({
      role: 'teller',
      status: 'approved'
    }).select('username name _id').sort('username');

    console.log(`✅ Found ${this.reportingTellers.length} approved tellers in reporting system`);
    return this.reportingTellers;
  }

  async loadBettingTellers() {
    console.log('🎯 Loading tellers from betting API...');

    const response = await fetch('https://rmi-gideon.gtarena.ph/api/m/secure/report/event', {
      method: 'GET',
      headers: {
        'X-TOKEN': 'af9735e1c7857a07f0b078df36842ace',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    this.bettingTellers = data.data.staffReports || [];

    console.log(`✅ Found ${this.bettingTellers.length} tellers in betting API`);
    return this.bettingTellers;
  }

  async findExactMatches() {
    console.log('🔍 Finding exact matches...');
    const exactMatches = [];

    for (const bettingTeller of this.bettingTellers) {
      const bettingParsed = this.parseBettingUsername(bettingTeller.username);

      // Normalize both usernames for comparison
      const normalizedBettingUsername = bettingTeller.username.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');

      // Try exact username match (normalized)
      const exactMatch = this.reportingTellers.find(rt =>
        rt.username.toLowerCase() === normalizedBettingUsername
      );

      if (exactMatch) {
        exactMatches.push({
          reportingTeller: exactMatch,
          bettingTeller: bettingTeller,
          confidence: 'exact',
          reason: 'Exact normalized username match'
        });
        continue;
      }

      // Try matching without the numeric prefix
      const noPrefixMatch = this.reportingTellers.find(rt =>
        rt.username.toLowerCase() === bettingParsed.name.toLowerCase()
      );

      if (noPrefixMatch) {
        exactMatches.push({
          reportingTeller: noPrefixMatch,
          bettingTeller: bettingTeller,
          confidence: 'exact',
          reason: 'Exact match without numeric prefix'
        });
      }
    }

    console.log(`✅ Found ${exactMatches.length} exact matches`);
    return exactMatches;
  }

  async findFuzzyMatches(availableReportingTellers) {
    console.log('🔍 Finding fuzzy matches...');
    const fuzzyMatches = [];

    for (const bettingTeller of this.bettingTellers) {
      // Skip if already matched
      const alreadyMatched = await TellerMapping.findOne({
        bettingUsername: bettingTeller.username,
        isActive: true
      });
      if (alreadyMatched) continue;

      const bettingParsed = this.parseBettingUsername(bettingTeller.username);
      let bestMatch = null;
      let bestSimilarity = 0;

      for (const reportingTeller of availableReportingTellers) {
        // Try name similarity
        const nameSimilarity = this.calculateSimilarity(
          bettingTeller.name,
          reportingTeller.name || reportingTeller.username
        );

        // Try username similarity
        const usernameSimilarity = this.calculateSimilarity(
          bettingParsed.name,
          reportingTeller.username
        );

        const similarity = Math.max(nameSimilarity, usernameSimilarity);

        if (similarity > bestSimilarity && similarity > 0.6) { // 60% similarity threshold
          bestMatch = reportingTeller;
          bestSimilarity = similarity;
        }
      }

      if (bestMatch) {
        fuzzyMatches.push({
          reportingTeller: bestMatch,
          bettingTeller: bettingTeller,
          confidence: 'fuzzy',
          reason: `Fuzzy match (${Math.round(bestSimilarity * 100)}% similarity)`
        });
      }
    }

    console.log(`✅ Found ${fuzzyMatches.length} fuzzy matches`);
    return fuzzyMatches;
  }

  async createMappings(matches) {
    console.log('💾 Creating teller mappings...');
    let created = 0;
    let skipped = 0;

    for (const match of matches) {
      try {
        console.log(`🔍 Checking mapping for ${match.bettingTeller.username}...`);

        // Check if mapping already exists
        const existing = await TellerMapping.findOne({
          bettingUsername: match.bettingTeller.username
        });

        console.log(`   Existing mapping check: ${existing ? 'FOUND' : 'NOT FOUND'}`);

        if (existing) {
          console.log(`⏭️ Skipping ${match.bettingTeller.username} - already mapped`);
          skipped++;
          continue;
        }

        console.log(`   Creating mapping for ${match.bettingTeller.username} -> ${match.reportingTeller.username}`);

        const mapping = new TellerMapping({
          tellerId: match.reportingTeller._id,
          bettingUsername: match.bettingTeller.username,
          bettingName: match.bettingTeller.name,
          matchConfidence: match.confidence,
          matchReason: match.reason,
          bettingData: {
            lastBetAmount: match.bettingTeller.betAmount || 0,
            lastSystemBalance: match.bettingTeller.systemBalance || 0,
            lastSyncDate: new Date()
          }
        });

        await mapping.save();
        console.log(`✅ Created mapping: ${match.bettingTeller.username} -> ${match.reportingTeller.username}`);
        created++;

      } catch (error) {
        console.error(`❌ Error creating mapping for ${match.bettingTeller.username}:`, error.message);
      }
    }

    console.log(`📊 Mapping creation complete: ${created} created, ${skipped} skipped`);
    return { created, skipped };
  }

  async generateUnmatchedReport() {
    console.log('📋 Generating unmatched tellers report...');

    const mappedUsernames = (await TellerMapping.find({ isActive: true }))
      .map(m => m.bettingUsername);

    const unmatchedBetting = this.bettingTellers.filter(bt =>
      !mappedUsernames.includes(bt.username)
    );

    const mappedTellerIds = (await TellerMapping.find({ isActive: true }))
      .map(m => m.tellerId.toString());

    const unmatchedReporting = this.reportingTellers.filter(rt =>
      !mappedTellerIds.includes(rt._id.toString())
    );

    console.log('\n🎯 UNMATCHED BETTING TELLERS:');
    console.log('===============================');
    unmatchedBetting.forEach((bt, i) => {
      console.log(`${i+1}. ${bt.username} - ${bt.name}`);
    });

    console.log('\n📊 UNMATCHED REPORTING TELLERS:');
    console.log('================================');
    unmatchedReporting.forEach((rt, i) => {
      console.log(`${i+1}. ${rt.username} - ${rt.name || 'No name'}`);
    });

    return { unmatchedBetting, unmatchedReporting };
  }

  async runMatchingProcess() {
    try {
      console.log('🚀 Starting Teller Matching Process');
      console.log('====================================');

      // Connect to database
      await mongoose.connect('mongodb://127.0.0.1:27017/rmi_teller_report');
      console.log('✅ Connected to database');

      // Load data
      await this.loadReportingTellers();
      await this.loadBettingTellers();

      // Find matches
      const exactMatches = await this.findExactMatches();
      await this.createMappings(exactMatches);

      // Get remaining unmatched tellers for fuzzy matching
      const mappedIds = exactMatches.map(m => m.reportingTeller._id.toString());
      const availableReportingTellers = this.reportingTellers.filter(rt =>
        !mappedIds.includes(rt._id.toString())
      );

      const fuzzyMatches = await this.findFuzzyMatches(availableReportingTellers);
      await this.createMappings(fuzzyMatches);

      // Generate final report
      await this.generateUnmatchedReport();

      console.log('\n🎉 Teller matching process complete!');

    } catch (error) {
      console.error('❌ Error in matching process:', error);
    } finally {
      await mongoose.connection.close();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the matching process
const matcher = new TellerMatcher();
matcher.runMatchingProcess();