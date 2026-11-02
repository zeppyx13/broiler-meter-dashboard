export type Facility = {
    id: number;
    name: string;
};

export type FacilityListResponse = {
    success: boolean;
    message: string;
    data: {
        facilities: Facility[];
    };
};