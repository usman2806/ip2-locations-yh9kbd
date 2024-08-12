import CryptoJS from 'crypto-js';
import dayjs from 'dayjs';
import { IP2Location } from 'ip2location-nodejs';
import path from 'path';
import { v4 as uuidV4 } from 'uuid';
import { CronLogModel } from '../../models/cron-log/cron-log';
import MimeCastSiemLogs from '../../models/mimecast/mimecast-siem-logs';
import mimecastSiemToken from '../../models/mimecast/mimecast-siem-token';
import { createLogService } from '../../utils/dal';
import { HttpCall, HttpCallResponse } from '../../utils/http-call';
import { jobLogger, logger } from '../../utils/logger';
import { getIpLocationData } from '../ip-locations/get-ip-locations-data';

async function getMimeCastLogsData(): Promise<void> {
  const log: CronLogModel = {} as CronLogModel;
  const serviceType: string = 'MimeCast';
  const processingDate: string = dayjs().toDate().toUTCString();

  try {
    jobLogger.info(`getMimeCastLogsData - Execute - ${processingDate}`);
    const httpCall: HttpCall = new HttpCall();

    const baseUrl: string = process.env.MIMECAST_BASE_URL;
    const uri: string = process.env.MIMECAST_URI;

    jobLogger.info(`getMimeCastLogsData - API URL - ${baseUrl}${uri}`);

    jobLogger.info(`getMimeCastLogsData - get api data start - ${processingDate}`);
    await processMimeCastAPIData(processingDate, httpCall, baseUrl, uri);
    jobLogger.info(`getMimeCastLogsData - get api data end - ${processingDate}`);

    // Saving the logs
    log.response = 'getMimeCast Successfull';
    log.isSuccess = true;
  } catch (error) {
    const errorMsg: string = `getMimeCastLogsData - ${processingDate} - ${error.message}, ${error.stack}`;
    log.response = errorMsg;
    log.isSuccess = false;
    jobLogger.error(errorMsg);
    throw error;
  } finally {
    jobLogger.info(`getMimeCastLogsData - Execute Final Block - ${processingDate}`);
    log.serviceType = serviceType;
    log.processingDate = dayjs(processingDate).toDate();

    await createLogService(log);
  }
}

async function processMimeCastAPIData(processingDate: string, httpCall: HttpCall, baseUrl: string, uri: string) {
  let token: string = '';
  let isContinue: boolean = true;
  const ipTool: IP2Location = new IP2Location();
  ipTool.open(path.join('output', 'IP2LOCATION-LITE-DB5.BIN'));
  try {
    token = await getToken();
    do {
      const response: any = await getMimeCastAPIData(httpCall, baseUrl, uri, token);

      if (response.data.data.length > 0) {
        for (const item of response.data.data) {
          let locationInfo: any = {};
          if (item?.IP) {
            locationInfo = await getIpLocationData(ipTool, item.IP);
          }
          await MimeCastSiemLogs.create({ processingDate: dayjs(processingDate).toISOString(), ...item, datetime: dayjs(item?.datetime).toISOString(), ...locationInfo });
        }
      }

      if (response.headers['mc-siem-token']) {
        token = response.headers['mc-siem-token'];
        await setToken(token);
      }

      if (response.headers['Content-Type'] === 'application/json') {
        logger.info('No more logs available');
        isContinue = false;
      }

      if (response.statusCode === 429) {
        logger.info('Rate limit hit. wait for ' + response.headers['X-RateLimit-Reset'] * 1000);
        isContinue = false;
      }

      if (response.statusCode !== 200) {
        logger.info('Request to ' + uri + ' returned with status code ' + response.statusCode + ', response.body: ' + response.data);
        isContinue = false;
      }

      if (!response?.data || response?.meta?.isLastToken) {
        logger.info('Request return with last token, Cannot continue');
        isContinue = false;
      }
    } while (token !== null && isContinue);
  } catch (error) {
    if (token) await setToken(token);
    throw error;
  } finally {
    if (token) await setToken(token);
    ipTool.close();
  }
}

async function getMimeCastAPIData(httpCall: HttpCall, baseUrl: string, uri: string, token: string = '') {
  const headers: any = MimeCastAuthorization(uri);
  const url: string = baseUrl + uri;
  const data: any = {
    data: [
      {
        type: 'MTA',
        token: token,
        fileFormat: 'json',
        compress: false,
      },
    ],
  };

  const timeout: number = 10 * 60 * 1000; // 10 minutes

  const response: HttpCallResponse = await httpCall.post({ url, data, headers, timeout: timeout });
  return {
    statusCode: response?.status || null,
    data: response?.data,
    headers: response.headers,
  };
}

/**
 * Function will get secret key for MIMECAST and return a header object
 * @param uri : string
 * @returns header with authorization token for MIMECAST API
 */
function MimeCastAuthorization(uri: string) {
  const secretKey: string = process.env.MIMECAST_SECRET_KEY;
  const accessKey: string = process.env.MIMECAST_ACCESS_KEY;
  const applicationKey: string = process.env.MIMECAST_APPLICATION_KEY;
  const applicationId: string = process.env.MIMECAST_APPLICATION_ID;

  const requestId: string = uuidV4();
  const date: string = new Date().toUTCString();
  let authorizationHeaderValue: string = '';

  if (!uri || !secretKey || !accessKey || !applicationKey || !applicationId) {
    throw Error('Missing required environment variables');
  } else {
    // Create the Authorization header value
    const concat: string = [date, requestId, uri, applicationKey].join(':');
    const encode: any = CryptoJS.enc.Base64.parse(secretKey);
    const hmac: string = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA1(concat, encode));
    authorizationHeaderValue = 'MC ' + accessKey + ':' + hmac;
  }

  //logger.info('Authorization Request Id:' + requestId);

  // Creating Header for MimeCast API
  const headers: any = {
    'x-mc-app-id': applicationId,
    'x-mc-date': date,
    'x-mc-req-id': requestId,
    Authorization: authorizationHeaderValue,
    'Content-Type': 'application/json',
    Accept: '*/*',
    Connection: 'keep-alive',
  };

  return headers;
}

async function getToken() {
  try {
    const data: any = await mimecastSiemToken.find();
    return data?.[0]?.token || '';
  } catch (err) {}
}

async function setToken(token: string) {
  try {
    const previousToken: any = await mimecastSiemToken.find();
    if (previousToken.length > 0)
      await mimecastSiemToken.findOneAndUpdate(
        {
          token: previousToken[0].token,
        },
        { token },
      );
    else {
      await mimecastSiemToken.create({ token });
    }
  } catch (error) {
    console.log(error);
  }
}

export { getMimeCastLogsData };
