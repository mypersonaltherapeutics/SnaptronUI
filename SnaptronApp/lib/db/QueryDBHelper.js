/**
 * Created by Phani on 2/19/2016.
 */

Meteor.methods({
    /**
     * Creates a query document and returns the ID after being inserted to the DB.
     * @param regionsStr User inputted regions query
     * @param filterFields Array of the included fields for filters
     * @param filterOpStrs Array of the chosen operators
     * @param filterVals Array of the user entered values
     * @returns {*} The ID of the inserted query, or null if it failed
     */
    "submitQuery": function (regionsStr, filterFields, filterOpStrs, filterVals) {
        check(regionsStr, String);
        check(filterFields, [String]);
        check(filterOpStrs, [String]);

        //Pre-process region string
        regionsStr = regionsStr.toLowerCase();
        regionsStr = regionsStr.replace(/\s+and\s+/g, ","); //"and" to comma
        regionsStr = regionsStr.replace(/\s+/g, ""); //Strip whitespace
        var regions = regionsStr.split(",");

        if (regions.length == 0) {
            return null;
        }

        //Assemble filters
        var filters = [];
        for (var i = 0; i < filterFields.length; i++) {
            var filter = {};
            if (!isNaN(filterVals[i])) {
                filter[QRY_FILTER_FIELD] = filterFields[i];
                filter[QRY_FILTER_OP] = getOpFromOptionStr(filterOpStrs[i]);
                filter[QRY_FILTER_VAL] = filterVals[i];
                filters.push(filter);
            }
        }

        //Attempt insert
        return newQuery(regions, filters);
    },
    "copyQuery": function (queryId) {
        var newQuery = getQuery(queryId);
        delete newQuery["_id"];
        delete newQuery[QRY_OWNER];
        var id = insertQuery(newQuery);
        console.log("Copied query " + queryId + " to " + id + " for user " + Meteor.userId());
        return id;
    }
});

/**
 * Returns the query with the given ID, or null.
 * @param queryId
 * @returns {any}
 */
getQuery = function (queryId) {
    check(queryId, String);
    return Queries.findOne({"_id": queryId});
};

hasQuery = function (queryId) {
    check(queryId, String);
    return Queries.find({"_id": queryId}, {"limit": 1}).count() > 0;
};

findQuery = function (queryId) {
    return Queries.find({"_id": queryId});
};

/**
 * Inserts a new query with the given regions and filters, returns the generated ID.
 * The currently logged in user is assigned as the owner.
 *
 * @param regionIds
 * @param filters
 * @returns {820|1027|*|any}
 */
newQuery = function (regionIds, filters) {
    check(regionIds, [String]);

    var queryDoc = {};
    if (regionIds == null) {
        queryDoc[QRY_REGIONS] = [];
    } else {
        queryDoc[QRY_REGIONS] = regionIds;
    }
    if (filters == null) {
        queryDoc[QRY_FILTERS] = [];
    }
    else {
        queryDoc[QRY_FILTERS] = filters;
    }

    return insertQuery(queryDoc);
};

insertQuery = function (queryDoc) {
    queryDoc[QRY_CREATED_DATE] = new Date();
    queryDoc[QRY_OWNER] = Meteor.userId();
    var id = Queries.insert(queryDoc);
    addQueryToUser(Meteor.userId(), id);
    return id;
};

/**
 * Add a region to the given query (by ID). Returns queryId on success,
 * and null on failure.
 *
 * @param queryId ID of query to add to
 * @param regionId Region id to add to the query
 * @returns {*} queryId or null
 */
addQueryRegion = function (queryId, regionId) {
    check(queryId, String);
    check(regionId, String);

    var pushCmd = {};
    pushCmd[QRY_REGIONS] = regionId;

    var changed = Queries.update({"_id": queryId}, {$push: pushCmd});
    if (changed > 0) {
        return queryId;
    }
    return null; //Nothing changed
};

/**
 * Adds a filter to the given query (by ID), and returns queryId on success,
 * and null on failure.
 *
 * @param queryId ID of query to add to
 * @param field The field to filter
 * @param opStr The operator string (<,>,=,...)
 * @param val The value of the filter
 * @returns {*} queryId or null
 */
addQueryFilter = function (queryId, field, opStr, val) {
    check(queryId, String);
    check(field, String);
    check(opStr, String);
    check(val, Number);

    if (!isNaN(val)) {
        var filterDoc = {};
        filterDoc[QRY_FILTER_FIELD] = field;
        filterDoc[QRY_FILTER_OP] = getOpFromOptionStr(opStr);
        filterDoc[QRY_FILTER_VAL] = val;
        var pushCmd = {};
        pushCmd[QRY_FILTERS] = filterDoc;

        var changed = Queries.update({"_id": queryId}, {$push: pushCmd});
        if (changed > 0) {
            return queryId;
        }
    }
    return null;
};

isQueryCurrentUsers = function (queryId) {
    return getQuery(queryId)[QRY_OWNER] == Meteor.userId();
};

/**
 * Converts an operator string to the Mongo operator.
 * @param opStr
 * @returns {*}
 */
function getOpFromOptionStr(opStr) {
    switch (opStr) {
        case '>':
            return MONGO_OPERATOR_GT;
        case '<':
            return MONGO_OPERATOR_LT;
        case '=':
            return MONGO_OPERATOR_EQ;
        case '≥':
            return MONGO_OPERATOR_GTE;
        case '≤':
            return MONGO_OPERATOR_LTE;
    }
    return null;
}