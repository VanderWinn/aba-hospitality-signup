# Questions the board dashboard should answer

Written before the layout. The page only keeps an element when it answers one of the questions below. Each question that stays maps to exactly one element.

The readers are ABA board and committee members: the president, the hospitality chair, ambassadors, and committee leads. They are not analysts. They open the portal to see whether hospitality is staffed and who to thank. The sign-up sheet is the only source. It records volunteers, not a membership roster, and it does not mark who is on the board.

## How often the questions come up

| Rhythm | Who asks | What they need before they leave |
| --- | --- | --- |
| Every time the portal is opened | President, hospitality chair | Are upcoming shifts filled, and which event still needs people? |
| Every meeting | Hospitality chair, ambassadors | Which roles are open, and who already signed up? |
| When someone should be thanked | President, hospitality chair | Who helped the most in this period? |
| Once a quarter | President, committee leads | Are we ahead of or behind last quarter, and which event types draw people? |
| When a name comes up | Any of them | What did this person do? |

## Ranked questions

Rank is how costly it is to leave the meeting without the answer. Audience is who asks it most.

| Rank | Question | Who asks | How often | On the page |
| --- | --- | --- | --- | --- |
| 1 | Are upcoming shifts filled? | Hospitality chair, president | Every visit | Yes |
| 2 | Which upcoming event still needs volunteers? | Hospitality chair | Every visit | Yes |
| 3 | Which roles are still open at that event? | Hospitality chair, ambassadors | Every meeting | Yes, one click from the event |
| 4 | Who is carrying the load? | President, hospitality chair | Every meeting | Yes |
| 5 | How many people helped? | President | Every visit | Yes |
| 6 | Are upcoming events covered? | President | Every visit | Yes |
| 7 | Who should we thank? | President, hospitality chair | When recognizing someone | Yes |
| 8 | Which months were busiest? | President, committee leads | Every visit | Yes |
| 9 | Which event types draw participation? | Committee leads, hospitality chair | Each quarter | Yes |
| 10 | Are we doing more or less than last quarter? | President | Each quarter | Yes |
| 11 | What did this person do? | Any member | When a name comes up | Yes, one click from the person |
| 12 | Who has not helped yet? | Hospitality chair, ambassadors | Sometimes | No. Cut. |

## What was cut, and why

- **Who has not helped yet?** The sheet has no roster of members who did not sign up. A blank list would look like an answer and would be wrong. The volunteer list says it only includes people who signed up.
- **Group by, breadcrumbs, and multi-select filters.** They answered "how do I reshape this?" rather than a question above. Four levels of drill took more than one click to reach a person or an event.
- **Company grouping.** The sheet has no company field, so a company chart would be empty.
- **A separate "this month" control.** Thanks and counts follow the period already on the page: this year, or this quarter. A third period would add a control for a question the year and quarter already cover.

## One question, one element

The short header is what a member reads. The question is the accessible name and the tooltip, so the number is tied to the words they would actually ask.

| Question | Element | Short header |
| --- | --- | --- |
| Are upcoming shifts filled? | First number tile. The big number is seats filled. "of N seats" and the percent are the small context. | Shifts filled |
| Are upcoming events covered? | Second number tile. Covered events, of upcoming events. | Events covered |
| How many people helped? | Third number tile. People with a shift in the selected period. | Volunteers |
| Who should we thank? | Fourth tile. The name of the person with the most shifts in the period, and that count. | Top volunteer |
| Are we doing more or less than last quarter? | One line under the tiles, for all event types. This quarter's shift count and last quarter's shift count. No color for "good" or "bad." | Compared with last quarter |
| Which months were busiest? | One bar chart for the selected period, including quiet months, with a Total bar. | Shifts by month |
| Which event types draw participation? | The event-type pills. Each pill shows that type's shift count before anyone clicks. | Event type |
| Who is carrying the load? | Ranked list of volunteers by shift count. | Top volunteers |
| Which upcoming event still needs volunteers? | List of upcoming events, largest gap first, each row "filled of seats." | Events that need people |
| Which roles are still open? | The event detail, opened by clicking that event. | The event name, with a Back button |
| What did this person do? | The person detail, opened by clicking that person. Date, event, and role. | The person's name, with a Back button |

The period pills (This year, This quarter) are not a separate question. They set the period for the tiles, the chart, and both lists. This year is the default, so the page is useful with no setup.

External attendance is not in this ranking. The sheet does not record guests. That block stays below the real numbers, uses the same tile-and-list pattern, and is labeled example data.
