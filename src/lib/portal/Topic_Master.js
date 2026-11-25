/** Exports: class Topic_Master (table tbl_topicmaster; static PROPS, static TABLE)
 *   async AllTopicList() : Topic_Master[]       (view window contains now, TopicTypeId 1, order by TopicName)
 *   async AllBlogList() : Topic_Master[]        (+ IsActive 1, Status 1)
 *   async AllClassifiedList() : Topic_Master[]  (TopicTypeId 2, IsActive 1, Status 1) */
'use strict';
const { query } = require('../../db');
const { mapRows } = require('../../utils/shape');

const PROPS = ['TTMID', 'TopicName', 'PostingInstruction', 'AccuracyTips', 'PostedDate', 'UserCanViewFromdate', 'UserCanViewTilldate',
  'TopicTypeId', 'TopicTypeName', 'Status', 'TotalNoOfPosting', 'TotalNoOfApproval', 'TotalNoOfRejection', 'MinNoOfWords', 'MaxNoOfWords',
  'NoOfRequirement', 'InstructionForIntroduction', 'InstructionForDescription', 'InstructionForConclusion', 'IsActive', 'TotalRemainPosting'];

// DateTime.Now compared against the date columns (date is promoted to midnight, as in SQL Server)
const WINDOW = 'usercanviewfromdate <= @currentdate and usercanviewtilldate >= @currentdate';

class Topic_Master {
  async AllTopicList() {
    return mapRows(await query('shopping', `select * from tbl_topicmaster where ${WINDOW} and topictypeid=1 order by topicname`, { currentdate: new Date() }), PROPS);
  }

  async AllBlogList() {
    return mapRows(await query('shopping', `select * from tbl_topicmaster where ${WINDOW} and topictypeid=1 and isactive=1 and status=1 order by topicname`, { currentdate: new Date() }), PROPS);
  }

  async AllClassifiedList() {
    return mapRows(await query('shopping', `select * from tbl_topicmaster where ${WINDOW} and topictypeid=2 and isactive=1 and status=1 order by topicname`, { currentdate: new Date() }), PROPS);
  }
}
Topic_Master.PROPS = PROPS;
Topic_Master.TABLE = 'tbl_topicmaster';

module.exports = Topic_Master;
