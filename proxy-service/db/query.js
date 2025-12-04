const isEligiblequery = `
    SELECT EXISTS (
        SELECT 1 FROM proxys.proxy_list 
        WHERE 
            id = $1 
            AND user_id = $2
    ) AS eligible;
`;

const insertQuery = `
    INSERT INTO proxys.proxy_list (user_id, name, start_date, end_date, phone_number)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id;
`;

const devSelectByIDQuery = `
    SELECT id, user_id, name, start_date, end_date, phone_number, created_at, updated_at
    FROM proxys.proxy_list
    WHERE 
        id = $1;
`;

const devSelectAllQuery = `
    SELECT id, user_id, name, start_date, end_date, phone_number, created_at, updated_at
    FROM proxys.proxy_list
`;

const selectByIDuserIDQuery = `
    SELECT id, user_id, name, start_date, end_date, phone_number, created_at, updated_at
    FROM proxys.proxy_list
    WHERE 
        id = $1 
        AND user_id = $2;
`;

const getByUserIDQuery = `
    SELECT id, user_id, name, start_date, end_date, phone_number, created_at, updated_at
    FROM proxys.proxy_list
    WHERE 
        user_id = $1 
    ORDER BY 
        created_at DESC
`;

const searchQuery = `
    SELECT id, user_id, name, start_date, end_date, phone_number, created_at, updated_at
    FROM 
        proxys.proxy_list
    WHERE 
        user_id = $2
        AND ( $1::text IS NULL OR name ILIKE '%' || $1 || '%' )
        
    ORDER BY 
        created_at DESC
    LIMIT $3 OFFSET $4;
`;
// ORDER BY created_at DESC, agent_ID DESC LIMIT 10;

async function dynamicUpdate(fields) {
    const updateQuery = `
        UPDATE proxys.proxy_list
        SET 
            ${fields.join(', ')},
            updated_at = now()
        WHERE 
            id = $1
        RETURNING id, user_id, name, start_date, end_date, phone_number, created_at, updated_at;
    `;
    return updateQuery;
} 

const deleteQuery = `
    DELETE FROM proxys.proxy_list
    WHERE
        id = $1
    RETURNING id
`;

export {
    isEligiblequery,
    insertQuery,
    devSelectByIDQuery, devSelectAllQuery,
    selectByIDuserIDQuery, getByUserIDQuery,
    searchQuery,
    dynamicUpdate,
    deleteQuery,
}