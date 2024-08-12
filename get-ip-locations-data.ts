import { IP2Location } from 'ip2location-nodejs';

export interface IGetIPLocationData {
  ipNumber?: string;
  countryCode?: string;
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

export async function getIpLocationData(
  ipTool: IP2Location,
  ipAddress: string
): Promise<IGetIPLocationData> {
  try {
    const {
      ipNo,
      countryShort,
      countryLong,
      region,
      city,
      latitude,
      longitude,
    } = ipTool.getAll(ipAddress);
    if (isNaN(Number(latitude)) || isNaN(Number(longitude))) {
      return {};
    }

    return {
      ipNumber: ipNo,
      countryCode: countryShort,
      country: countryLong,
      region: region,
      city: city,
      latitude: Number(latitude),
      longitude: Number(longitude),
    };
  } catch (e) {
    throw e;
  }
}
