class DatabaseError extends Error {

}

class UniqueConstraintError extends DatabaseError {
    constructor() {
        super('23505')
    }
}

class RequestSyntaxError extends DatabaseError {
    constructor() {
        super('42601')
    }
}

export {
    DatabaseError,
    UniqueConstraintError,
    RequestSyntaxError
}