const isEligiblequery = `
    SELECT EXISTS (
        SELECT 1 FROM reminders.reminder_list 
        WHERE 
            id = $1 
            AND user_id = $2
    ) AS eligible;
`;

const insertReminderQuery = `
    INSERT INTO reminders.reminder_list (user_id, name, notes, is_active, due_at, due_day, is_proxy, proxy)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id;
`;

const devSelectByIDQuery = `
    SELECT id, user_id, name, notes, is_active, due_at, due_day, is_proxy, proxy, created_at, updated_at
    FROM reminders.reminder_list
    WHERE 
        id = $1;
`;

const devSelectAllQuery = `
    SELECT id, user_id, name, notes, is_active, due_at, due_day, is_proxy, proxy, created_at, updated_at
    FROM reminders.reminder_list
`;

const selectByIDuserIDQuery = `
    SELECT id, user_id, name, notes, is_active, due_at, due_day, is_proxy, proxy, created_at, updated_at
    FROM reminders.reminder_list
    WHERE 
        id = $1 
        AND user_id = $2;
`;

const getByUserIDQuery = `
    SELECT id, user_id, name, notes, is_active, due_at, due_day, is_proxy, proxy, created_at, updated_at
    FROM reminders.reminder_list
    WHERE 
        user_id = $1 
    ORDER BY 
        created_at DESC
`;

const getDueSoonQuery = `
  SELECT
    id,
    user_id,
    name,
    notes,
    is_proxy,
    proxy,
    due_at,
    due_day,
    created_at,
    updated_at
  FROM reminders.reminder_list
  WHERE
    (
      -- one-time reminders (no recurrence array) due within window
      (
        COALESCE(array_length(due_day, 1), 0) = 0
        AND due_at BETWEEN NOW() AND NOW() + ($1::int * INTERVAL '1 second')
      )
      OR
      -- recurring reminders: today’s weekday matches AND time-of-day is within window
      (
        COALESCE(array_length(due_day, 1), 0) > 0
        AND EXTRACT(DOW FROM NOW())::int = ANY(due_day)
        AND (
          (date_trunc('day', NOW()) + due_at::time)
          BETWEEN NOW() AND NOW() + ($1::int * INTERVAL '1 second')
        )
      )
    )
  ORDER BY
    -- Order by the “next fire time” so the queue is nice and FIFO
    CASE
      WHEN COALESCE(array_length(due_day, 1), 0) > 0
        THEN (date_trunc('day', NOW()) + due_at::time)
      ELSE due_at
    END ASC;
`;

async function dynamicUpdate(fields) {
    const updateQuery = `
        UPDATE reminders.reminder_list
        SET 
            ${fields.join(', ')},
            updated_at = now()
        WHERE 
            id = $1
        RETURNING id, user_id, name, notes, due_at, created_at, updated_at;
    `;
    return updateQuery;
} 

// const softDeleteQuery = `
//     UPDATE reminders.reminder_list
//     SET 
//         deleted_by = $2, 
//         deleted_at = now(), 
//         updated_at = now(), 
//         delete_reason = $3
//     WHERE 
//         id = $1
//         AND agent_ID = $2
//         AND deleted_at IS NULL
//     RETURNING id, deleted_at
// `;

const deleteQuery = `
    DELETE FROM reminders.reminder_list
    WHERE
        id = $1
    RETURNING id;
`;

export {
    isEligiblequery,
    insertReminderQuery,
    devSelectByIDQuery, devSelectAllQuery,
    selectByIDuserIDQuery, getByUserIDQuery, getDueSoonQuery,
    dynamicUpdate,
    deleteQuery,
}