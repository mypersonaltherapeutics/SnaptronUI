/**
 * Created by Phani on 3/11/2016.
 *
 * Sample Normalized Difference
 *
 * Computes the normalized difference between 2 input groups.
 * The results have two fields. The TOP_K result contains the top
 * results in the following format:
 * {    "sample" : "some sampleId",
 *      "A" : count of sample found in group A,
 *      "B" : count of sample found in group B,
 *      "D" : normalized ration (B-A)/(B+A+1)
 * }
 *
 * The HIST result contains frequency data from the unabridged result set.
 * The format of the histogram is an array of:
 * {    "start" : the bin starting D,
 *      "end"   : the bin ending D,
 *      "count" : the frequency of this bin
 * }
 *
 * The top K results are returned, as well as frequency information
 * from the complete data set.
 *
 * Expected parameters:
 *      k: The top k results to return
 *
 * Optional parameters:
 *      None
 *
 */

const NUM_HIST_BINS    = 15;
SnapApp.Processors.SND = {};

SnapApp.Processors.SND.RESULTS_TOP_K     = "topk";
SnapApp.Processors.SND.RESULTS_HIST      = "hist";
SnapApp.Processors.SND.RESULT_HIST_START = "start";
SnapApp.Processors.SND.RESULT_HIST_END   = "end";
SnapApp.Processors.SND.RESULT_HIST_COUNT = "count";

if (Meteor.isServer) {
    Meteor.methods({
        "sampleNormalizedDifference": function (queryId, inputGroups, params) {
            this.unblock();
            if (!validateInput(inputGroups, params)) {
                return null;
            }
            return sampleNormalizedDifference(queryId, inputGroups["A"], inputGroups["B"], params["k"]);
        }
    });
}

function sampleNormalizedDifference(queryId, groupIdA, groupIdB, k) {
    var A = getSampleCoverages(queryId, groupIdA);
    var B = getSampleCoverages(queryId, groupIdB);

    var allSamps   = _.union(_.keys(A), _.keys(B));
    var allResults = _.map(allSamps, function (sample) {
        var aVal = A[sample] || 0;
        var bVal = B[sample] || 0;
        return {
            "A": aVal,
            "B": bVal,
            "sample": sample,
            "D": (bVal - aVal) / (bVal + aVal + 1)
        };
    });
    var sorted     = _.sortBy(allResults, "D");
    var results    = {};

    results[SnapApp.Processors.SND.RESULTS_TOP_K] = _.last(sorted, k);
    results[SnapApp.Processors.SND.RESULTS_HIST]  = getHistogram(sorted);

    return results;
}

function getHistogram(results) {
    var dat      = _.pluck(results, "D");
    var binDelta = 2 / (NUM_HIST_BINS);

    var counts = _.countBy(dat, function (d) {
        return parseInt(Math.min(NUM_HIST_BINS - 1, Math.floor((d + 1) / binDelta))).toString();
    });
    var hist   = [];
    for (var i = 0; i < NUM_HIST_BINS; i++) {
        var obj                                       = {};
        obj[SnapApp.Processors.SND.RESULT_HIST_START] = -1 + i * binDelta;
        obj[SnapApp.Processors.SND.RESULT_HIST_END]   = -1 + (i + 1) * binDelta;
        obj[SnapApp.Processors.SND.RESULT_HIST_COUNT] = counts[i.toString()] || 0;
        hist.push(obj);
    }
    return hist;
}

function getSampleCoverages(queryId, groupId) {
    var group = SnapApp.QueryDB.getGroupFromQuery(queryId, groupId);
    var jncts = SnapApp.JunctionDB.getJunctions(group[QRY_GROUP_JNCTS]);

    /**
     * The result of this is an object with keys being a sample, and the
     * value is an array of objects with {"samp":samp,"cov":cov}
     */
    var grouped = _.groupBy(_.flatten(_.map(jncts, getJnctSampleCoverages)), "samp");
    var result  = {};
    _.each(_.keys(grouped), function (sample) {
        //Sum all of the coverages for this sample
        result[sample] = _.reduce(_.pluck(grouped[sample], "cov"), function (memo, num) {
            return memo + num;
        }, 0);
    });

    return result;
}

function getJnctSampleCoverages(jnct) {
    return _.map(_.range(0, jnct[JNCT_SAMPLES_KEY].length), function (i) {
        return {
            "samp": jnct[JNCT_SAMPLES_KEY][i],
            "cov": jnct[JNCT_COVERAGE_KEY][i]
        };
    })
}

function validateInput(inputGroups, params) {
    if (!_.contains(_.keys(inputGroups), "A") || !_.contains(_.keys(inputGroups), "B")) {
        // Proper input groups not present
        return false;
    }
    var k;
    if (!_.contains(_.keys(params), "k")) {
        return false;
    } else {
        k = parseInt(params["k"]);
        if (!_.isFinite(k) || k <= 0) {
            // Invalid k value
            return false;
        }
    }
    return true;
}
