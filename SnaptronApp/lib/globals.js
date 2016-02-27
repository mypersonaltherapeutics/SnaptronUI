/**
 * Created by Phani on 2/26/2016.
 */
MONGO_OPERATOR_EQ = "$eq";
MONGO_OPERATOR_GT = "$gt";
MONGO_OPERATOR_LT = "$lt";
MONGO_OPERATOR_GTE = "$gte";
MONGO_OPERATOR_LTE = "$lte";

QUERY_REGIONS = "regions";
QUERY_FILTERS = "filters";
QUERY_CREATED_DATE = "createdDate";

QUERY_FILTER_FIELD = "filter";
QUERY_FILTER_OP = "op";
QUERY_FILTER_VAL = "val";
QUERY_FILTER_SAMPLE_COUNT = "samples_count";
QUERY_FILTER_COV_SUM = "coverage_sum";
QUERY_FILTER_COV_AVG = "coverage_avg";
QUERY_FILTER_COV_MED = "coverage_median";
QUERY_FILTER_LENGTH = "length";

REGION_METADATA = "metadata";
REGION_LOADED_DATE = "loadedDate";
REGION_JUNCTIONS = "junctions";
REGION_METADATA_KEY = "key";
REGION_METADATA_VAL = "value";

JUNCTION_ANNOTATED = "annotated?";
JUNCTION_COLUMN_TYPES = {
    "DataSource:Type": "str",
    "snaptron_id": "str",
    "chromosome": "str",
    "start": "int",
    "end": "int",
    "length": "int",
    "strand": "str",
    "annotated?": "bool",
    "left_motif": "str",
    "right_motif": "str",
    "left_annotated?": "str",
    "right_annotated?": "str",
    "samples": "str",
    "read_coverage_by_sample": "str",
    "samples_count": "int",
    "coverage_sum": "float",
    "coverage_avg": "float",
    "coverage_median": "float",
    "source_dataset_id": "str"
};